import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { Client } from '../client/entities/client.entity';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class SalesOrderService {
  constructor(
    @InjectRepository(SalesOrder)
    private salesOrderRepository: Repository<SalesOrder>,
    @InjectRepository(SalesOrderItem)
    private salesOrderItemRepository: Repository<SalesOrderItem>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(Business)
    private businessRepository: Repository<Business>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    private dataSource: DataSource,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  private async generateSalesOrderNumber(businessId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;
    
    const latestOrder = await this.salesOrderRepository
      .createQueryBuilder('salesOrder')
      .where('salesOrder.businessId = :businessId', { businessId })
      .andWhere('salesOrder.salesOrderNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('salesOrder.createdAt', 'DESC')
      .getOne();

    let increment = 1;
    if (latestOrder?.salesOrderNumber) {
      const parts = latestOrder.salesOrderNumber.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          increment = lastNum + 1;
        }
      }
    }

    return `${prefix}${increment.toString().padStart(3, '0')}`;
  }

  async create(businessId: string, createSalesOrderDto: CreateSalesOrderDto, userId?: string, userEmail?: string): Promise<SalesOrder> {
    const client = await this.clientRepository.findOne({
      where: { id: createSalesOrderDto.clientId, businessId },
    });
    if (!client) {
      throw new BadRequestException('Client not found or does not belong to your business');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let subtotal = 0;
      const items = createSalesOrderDto.items.map(item => {
        const itemTotal = item.quantity * item.unitPrice;
        subtotal += itemTotal;
        return {
          ...item,
          total: itemTotal,
        };
      });

      const salesOrderNumber = await this.generateSalesOrderNumber(businessId);

      const business = await this.businessRepository.findOne({ where: { id: businessId } });
      if (!business) {
        throw new NotFoundException('Business not found');
      }

      const taxRate = Number(business.taxRate) || 0;
      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(3));
      const totalAmount = Number((subtotal + taxAmount).toFixed(3));

      const { items: _, ...orderData } = createSalesOrderDto;
      const salesOrder = this.salesOrderRepository.create({
        ...orderData,
        businessId,
        salesOrderNumber,
        subtotal,
        taxAmount,
        totalAmount,
        taxRate,
        status: createSalesOrderDto.status || SalesOrderStatus.DRAFT,
      });

      const savedOrder = await queryRunner.manager.save(salesOrder);

      for (const item of items) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = item.productId && uuidRegex.test(item.productId);
        const productId = isValidUUID ? item.productId : null;

        await queryRunner.manager.query(
          `INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, description, total) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            require('uuid').v4(),
            savedOrder.id,
            productId,
            item.quantity,
            item.unitPrice,
            item.description,
            item.total,
          ],
        );
      }

      await queryRunner.commitTransaction();

      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'created_sales_order',
        'SalesOrder',
        savedOrder.id,
        {
          salesOrderNumber: savedOrder.salesOrderNumber,
          clientName: client.name,
          clientId: client.id,
          totalAmount: savedOrder.totalAmount,
          itemCount: items.length,
          sourceQuoteId: createSalesOrderDto.sourceQuoteId,
        },
        businessId,
      );

      return this.findOne(savedOrder.id, businessId);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string): Promise<SalesOrder[]> {
    return this.salesOrderRepository.find({
      where: { businessId },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<SalesOrder> {
    const salesOrder = await this.salesOrderRepository.findOne({
      where: { id, businessId },
      relations: ['items', 'items.product', 'business', 'client'],
    });
    if (!salesOrder) {
      throw new NotFoundException('Sales order not found');
    }
    return salesOrder;
  }

  async update(id: string, businessId: string, updateSalesOrderDto: UpdateSalesOrderDto, userId?: string, userEmail?: string): Promise<SalesOrder> {
    const salesOrder = await this.findOne(id, businessId);

    if (salesOrder.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft sales orders can be updated');
    }

    if (updateSalesOrderDto.clientId) {
      const client = await this.clientRepository.findOne({
        where: { id: updateSalesOrderDto.clientId, businessId },
      });
      if (!client) {
        throw new BadRequestException('Client not found or does not belong to your business');
      }
    }

    Object.assign(salesOrder, updateSalesOrderDto);
    const savedOrder = await this.salesOrderRepository.save(salesOrder);

    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'updated_sales_order',
      'SalesOrder',
      savedOrder.id,
      {
        salesOrderNumber: savedOrder.salesOrderNumber,
        changes: Object.keys(updateSalesOrderDto),
      },
      businessId,
    );

    return savedOrder;
  }

  async confirm(id: string, businessId: string, userId?: string, userEmail?: string): Promise<SalesOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const salesOrder = await this.findOne(id, businessId);

      if (salesOrder.status !== SalesOrderStatus.DRAFT) {
        throw new BadRequestException('Only draft sales orders can be confirmed');
      }

      // Validate stock and reserve for storable products
      for (const item of salesOrder.items) {
        if (!item.productId) continue;

        const product = await this.productRepository.findOne({
          where: { id: item.productId, businessId },
        });

        if (product && product.productType === 'storable') {
          if (product.quantity < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for ${product.name}. Available: ${product.quantity}, Required: ${item.quantity}`
            );
          }

          // Reserve stock by decreasing available quantity
          product.quantity -= item.quantity;
          await queryRunner.manager.save(product);

          // Create stock movement for reservation
          const stockMovement = this.stockMovementRepository.create({
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            reason: 'sales_order_confirmed',
            notes: `Reserved for sales order ${salesOrder.salesOrderNumber}`,
            referenceId: salesOrder.id,
            businessId,
            date: new Date(),
          });
          await queryRunner.manager.save(stockMovement);
        }
      }

      salesOrder.status = SalesOrderStatus.CONFIRMED;
      const savedOrder = await queryRunner.manager.save(salesOrder);

      await queryRunner.commitTransaction();

      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'confirmed_sales_order',
        'SalesOrder',
        savedOrder.id,
        {
          salesOrderNumber: savedOrder.salesOrderNumber,
        },
        businessId,
      );

      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async deliver(id: string, businessId: string, userId?: string, userEmail?: string): Promise<SalesOrder> {
    const salesOrder = await this.findOne(id, businessId);

    if (salesOrder.status !== SalesOrderStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed sales orders can be marked as delivered');
    }

    salesOrder.status = SalesOrderStatus.DELIVERED;
    const savedOrder = await this.salesOrderRepository.save(salesOrder);

    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'delivered_sales_order',
      'SalesOrder',
      savedOrder.id,
      {
        salesOrderNumber: savedOrder.salesOrderNumber,
      },
      businessId,
    );

    return savedOrder;
  }

  async cancel(id: string, businessId: string, userId?: string, userEmail?: string): Promise<SalesOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const salesOrder = await this.findOne(id, businessId);

      if (salesOrder.status === SalesOrderStatus.CANCELLED) {
        throw new BadRequestException('Sales order is already cancelled');
      }

      if (salesOrder.status === SalesOrderStatus.DELIVERED) {
        throw new BadRequestException('Delivered sales orders cannot be cancelled');
      }

      // If was confirmed, release reserved stock
      if (salesOrder.status === SalesOrderStatus.CONFIRMED) {
        for (const item of salesOrder.items) {
          if (!item.productId) continue;

          const product = await this.productRepository.findOne({
            where: { id: item.productId, businessId },
          });

          if (product && product.productType === 'storable') {
            // Release reserved stock
            product.quantity += item.quantity;
            await queryRunner.manager.save(product);

            // Create stock movement for release
            const stockMovement = this.stockMovementRepository.create({
              productId: item.productId,
              type: 'IN',
              quantity: item.quantity,
              reason: 'sales_order_cancelled',
              notes: `Released from cancelled sales order ${salesOrder.salesOrderNumber}`,
              referenceId: salesOrder.id,
              businessId,
              date: new Date(),
            });
            await queryRunner.manager.save(stockMovement);
          }
        }
      }

      salesOrder.status = SalesOrderStatus.CANCELLED;
      const savedOrder = await queryRunner.manager.save(salesOrder);

      await queryRunner.commitTransaction();

      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'cancelled_sales_order',
        'SalesOrder',
        savedOrder.id,
        {
          salesOrderNumber: savedOrder.salesOrderNumber,
          previousStatus: salesOrder.status,
        },
        businessId,
      );

      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const salesOrder = await this.findOne(id, businessId);

    if (salesOrder.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft sales orders can be deleted');
    }

    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'deleted_sales_order',
      'SalesOrder',
      salesOrder.id,
      {
        salesOrderNumber: salesOrder.salesOrderNumber,
        clientName: salesOrder.client?.name,
        totalAmount: salesOrder.totalAmount,
      },
      businessId,
    );

    await this.salesOrderRepository.remove(salesOrder);
  }

  async duplicate(id: string, businessId: string, userId?: string, userEmail?: string): Promise<SalesOrder> {
    const originalOrder = await this.findOne(id, businessId);

    const newOrderDto: CreateSalesOrderDto = {
      clientId: originalOrder.clientId,
      notes: originalOrder.notes,
      issueDate: new Date(),
      items: originalOrder.items
        .filter(item => item.productId !== null)
        .map(item => ({
          productId: item.productId!,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          description: item.description,
        })),
    };

    return this.create(businessId, newOrderDto, userId, userEmail);
  }

  async convertToInvoice(id: string, businessId: string, invoiceService: any, userId?: string, userEmail?: string): Promise<any> {
    const salesOrder = await this.findOne(id, businessId);

    if (salesOrder.status !== SalesOrderStatus.CONFIRMED && salesOrder.status !== SalesOrderStatus.DELIVERED) {
      throw new BadRequestException('Only confirmed or delivered sales orders can be converted to invoices');
    }

    if (salesOrder.convertedToInvoiceId) {
      throw new BadRequestException('Sales order has already been converted to an invoice');
    }

    const invoiceData = {
      clientId: salesOrder.clientId,
      notes: salesOrder.notes,
      dueDate: null,
      items: salesOrder.items
        .filter(item => item.productId !== null)
        .map(item => ({
          productId: item.productId!,
          quantity: item.quantity,
          price: Number(item.unitPrice),
          description: item.description,
        })),
      sourceSalesOrderId: salesOrder.id,
    };

    const invoice = await invoiceService.create(businessId, invoiceData, userId, userEmail);

    salesOrder.convertedToInvoiceId = invoice.id;
    await this.salesOrderRepository.save(salesOrder);

    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'converted_sales_order_to_invoice',
      'SalesOrder',
      salesOrder.id,
      {
        salesOrderNumber: salesOrder.salesOrderNumber,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      },
      businessId,
    );

    return invoice;
  }
}
