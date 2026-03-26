import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';

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
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    private dataSource: DataSource,
  ) {}

  async create(businessId: string, createInvoiceDto: CreateInvoiceDto): Promise<Invoice> {
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

      // Generate invoice number
      const invoiceCount = await this.invoiceRepository.count({ where: { businessId } });
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${(invoiceCount + 1).toString().padStart(4, '0')}`;

      // Create invoice - explicitly exclude items to prevent cascade save
      const { items: _, ...invoiceData } = createInvoiceDto;
      const invoice = this.invoiceRepository.create({
        ...invoiceData,
        businessId,
        invoiceNumber,
        subtotal,
        taxAmount: 0,
        totalAmount: subtotal,
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
        if (isValidUUID && productId) {
          const product = await this.productRepository.findOne({
            where: { id: productId, businessId },
          });
          
          if (product) {
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
        }
      }

      await queryRunner.commitTransaction();

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
      relations: ['items', 'items.product', 'business'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async update(id: string, businessId: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice> {
    const invoice = await this.findOne(id, businessId);
    Object.assign(invoice, updateInvoiceDto);
    return this.invoiceRepository.save(invoice);
  }

  async updateStatus(id: string, businessId: string, status: InvoiceStatus): Promise<Invoice> {
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
      return savedInvoice;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, businessId: string): Promise<void> {
    const invoice = await this.findOne(id, businessId);
    await this.invoiceRepository.remove(invoice);
  }

  async generatePdf(id: string, businessId: string): Promise<Buffer> {
    const invoice = await this.findOne(id, businessId);
    // PDF generation will be implemented separately
    return Buffer.from('PDF content');
  }
}
