import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Product } from '../product/entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Client } from '../client/entities/client.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Cash)
    private cashRepository: Repository<Cash>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    private dataSource: DataSource,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async create(businessId: string, createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
    // Validate client exists and belongs to business
    const client = await this.clientRepository.findOne({
      where: { id: createInvoiceDto.clientId, businessId },
    });
    if (!client) {
      throw new BadRequestException('Client not found or does not belong to your business');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Calculate totals
      let subtotal = 0;
      const items = createInvoiceDto.items.map(item => {
        const itemTotal = item.quantity * item.price;
        subtotal += itemTotal;
        return {
          ...item,
          total: itemTotal,
        };
      });

      // Generate invoice number - format: INV-[YEAR]-[INCREMENT]
      const year = new Date().getFullYear();
      const prefix = `INV-${year}-`;
      
      const latestInvoice = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .where('invoice.businessId = :businessId', { businessId })
        .andWhere('invoice.invoiceNumber LIKE :prefix', { prefix: `${prefix}%` })
        .orderBy('invoice.createdAt', 'DESC')
        .getOne();

      let increment = 1;
      if (latestInvoice?.invoiceNumber) {
        const parts = latestInvoice.invoiceNumber.split('-');
        if (parts.length === 3) {
          const lastNum = parseInt(parts[2], 10);
          if (!isNaN(lastNum)) {
            increment = lastNum + 1;
          }
        }
      }

      const invoiceNumber = `${prefix}${increment.toString().padStart(3, '0')}`;

      const business = await this.businessRepository.findOne({ where: { id: businessId } });
      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const taxRate = Number(business.taxRate) || 0;
      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
      const totalAmount = Number((subtotal + taxAmount).toFixed(2));

      // Create invoice - explicitly exclude items to prevent cascade save
      const { items: _, sourceQuoteId, sourceSalesOrderId, ...invoiceData } = createInvoiceDto;
      const invoice = this.invoiceRepository.create({
        ...invoiceData,
        businessId,
        invoiceNumber,
        subtotal,
        taxAmount,
        totalAmount,
        sourceQuoteId,
        sourceSalesOrderId,
      });

      const savedInvoice = await queryRunner.manager.save(invoice);

      // Create invoice items - handle invalid productIds and decrease stock
      for (const item of items) {
        // Validate if productId is a valid UUID, otherwise set to null
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = item.productId && uuidRegex.test(item.productId);
        const productId = isValidUUID ? item.productId : null;
        
        // Use raw query to ensure null is properly inserted
        await queryRunner.manager.query(
          `INSERT INTO invoice_items (id, invoice_id, product_id, quantity, price, description, total) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            require('uuid').v4(),
            savedInvoice.id,
            productId,
            item.quantity,
            item.price,
            item.description,
            item.total
          ]
        );

        // AUTO: Decrease stock for valid products (Invoice → Stock Decrement)
        // Only apply stock tracking for storable products
        if (isValidUUID && productId) {
          const product = await this.productRepository.findOne({
            where: { id: productId, businessId },
          });
          
          if (product && product.productType === 'storable') {
            // Validate sufficient stock
            if (product.quantity < item.quantity) {
              throw new BadRequestException(
                `Insufficient stock for ${product.name}. Available: ${product.quantity}, Required: ${item.quantity}`
              );
            }
            
            // Decrease product stock
            product.quantity -= item.quantity;
            await queryRunner.manager.save(product);
            
            // Create stock movement record (OUT - Sale)
            const stockMovement = this.stockMovementRepository.create({
              productId: productId,
              type: 'OUT',
              quantity: item.quantity,
              reason: 'sale',
              notes: `Sale from invoice ${invoiceNumber}`,
              referenceId: savedInvoice.id,
              businessId,
              date: new Date(),
            });
            await queryRunner.manager.save(stockMovement);
          }
          // For consumable and service products: skip stock validation and tracking
        }
      }

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        'system',
        'system@localhost',
        'created_invoice',
        'Invoice',
        savedInvoice.id,
        {
          invoiceNumber: savedInvoice.invoiceNumber,
          clientName: client.name,
          clientId: client.id,
          totalAmount: savedInvoice.totalAmount,
          itemCount: items.length,
        },
        businessId,
      );

      // Create notification
      try {
        await this.notificationService.create(
          businessId,
          'New Invoice Created',
          `Invoice ${savedInvoice.invoiceNumber} created for ${client.name} - TND ${Number(savedInvoice.totalAmount).toFixed(3)}`,
          'info',
          'invoice',
          `/invoices/${savedInvoice.id}`,
          savedInvoice.id,
          'Invoice',
        );
      } catch (err) {
        // Notification failure should not fail the main operation
        console.error('Failed to create notification:', err);
      }

      return this.findOne(savedInvoice.id, businessId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string): Promise<Invoice[]> {
    return this.invoiceRepository.find({
      where: { businessId },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id, businessId },
      relations: ['items', 'items.product', 'business', 'client'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async update(id: string, businessId: string, updateInvoiceDto: UpdateInvoiceDto, userId?: string, userEmail?: string): Promise<Invoice> {
    const invoice = await this.findOne(id, businessId);

    // If clientId is being updated, validate the new client exists
    if (updateInvoiceDto.clientId) {
      const client = await this.clientRepository.findOne({
        where: { id: updateInvoiceDto.clientId, businessId },
      });
      if (!client) {
        throw new BadRequestException('Client not found or does not belong to your business');
      }
    }

    Object.assign(invoice, updateInvoiceDto);
    const savedInvoice = await this.invoiceRepository.save(invoice);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'updated_invoice',
      'Invoice',
      savedInvoice.id,
      {
        invoiceNumber: savedInvoice.invoiceNumber,
        changes: Object.keys(updateInvoiceDto),
      },
      businessId,
    );

    return savedInvoice;
  }

  async updateStatus(id: string, businessId: string, status: InvoiceStatus, userId?: string, userEmail?: string): Promise<Invoice> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invoice = await this.findOne(id, businessId);
      const previousStatus = invoice.status;
      invoice.status = status;
      const savedInvoice = await queryRunner.manager.save(invoice);

      // Auto-create payment when invoice is marked as paid
      if (status === 'paid' && previousStatus !== 'paid') {
        // Create payment record
        const payment = this.paymentRepository.create({
          type: 'IN',
          amount: invoice.totalAmount,
          method: 'transfer', // Default method for invoice payments
          description: `Payment for invoice ${invoice.invoiceNumber}`,
          referenceId: invoice.id,
          referenceType: 'invoice',
          date: new Date(),
          businessId,
        });
        await queryRunner.manager.save(payment);

        // Update cash balance
        let cash = await this.cashRepository.findOne({ where: { businessId } });
        if (!cash) {
          cash = this.cashRepository.create({
            businessId,
            currentBalance: 0,
          });
        }
        cash.currentBalance += Number(invoice.totalAmount);
        await queryRunner.manager.save(cash);
      }

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        `changed_invoice_status_${status}`,
        'Invoice',
        savedInvoice.id,
        {
          invoiceNumber: savedInvoice.invoiceNumber,
          previousStatus,
          newStatus: status,
          amount: invoice.totalAmount,
        },
        businessId,
      );

      return savedInvoice;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const invoice = await this.findOne(id, businessId);
    
    // Log audit before deletion
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'deleted_invoice',
      'Invoice',
      invoice.id,
      {
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client?.name,
        totalAmount: invoice.totalAmount,
      },
      businessId,
    );

    await this.invoiceRepository.remove(invoice);
  }

  async generatePdf(id: string, businessId: string): Promise<Buffer> {
    const invoice = await this.findOne(id, businessId);
    // PDF generation will be implemented separately
    return Buffer.from('PDF content');
  }
}
