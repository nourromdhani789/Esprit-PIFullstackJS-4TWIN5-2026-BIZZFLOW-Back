import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Product } from '../product/entities/product.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, ReceivePurchaseOrderDto } from './dto/purchase-order.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(businessId: string, createDto: CreatePurchaseOrderDto, userId?: string, userEmail?: string): Promise<PurchaseOrder> {
    // Validate supplier exists
    const supplier = await this.supplierRepository.findOne({
      where: { id: createDto.supplierId, businessId },
    });
    if (!supplier) {
      throw new BadRequestException('Supplier not found');
    }

    const order = this.purchaseOrderRepository.create({
      ...createDto,
      supplierId: supplier.id,
      supplierName: supplier.name,
      businessId,
      date: createDto.date || new Date(),
      status: createDto.status || 'pending',
    });

    const savedOrder = await this.purchaseOrderRepository.save(order);

    // Log audit
    try {
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        'created_purchase_order',
        'PurchaseOrder',
        savedOrder.id,
        {
          supplierName: savedOrder.supplierName,
          totalAmount: savedOrder.totalAmount,
          date: savedOrder.date,
        },
        businessId,
      );
    } catch (err) {
      console.error('Failed to log audit:', err);
    }

    return savedOrder;
  }

  async findAll(businessId: string, status?: string): Promise<PurchaseOrder[]> {
    const where: any = { businessId };
    if (status) {
      where.status = status;
    }

    return this.purchaseOrderRepository.find({
      where,
      order: { date: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<PurchaseOrder> {
    const order = await this.purchaseOrderRepository.findOne({
      where: { id, businessId },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    return order;
  }

  async update(id: string, businessId: string, updateDto: UpdatePurchaseOrderDto, userId?: string, userEmail?: string): Promise<PurchaseOrder> {
    const order = await this.findOne(id, businessId);

    // Prevent updating received orders
    if (order.status === 'received') {
      throw new BadRequestException('Cannot update a received order');
    }

    // If updating supplier, validate it exists
    if (updateDto.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: updateDto.supplierId, businessId },
      });
      if (!supplier) {
        throw new BadRequestException('Supplier not found');
      }
      order.supplierId = supplier.id;
      order.supplierName = supplier.name;
    }

    Object.assign(order, updateDto);
    return this.purchaseOrderRepository.save(order);
  }

  async markAsReceived(
    id: string, 
    businessId: string, 
    receiveDto: ReceivePurchaseOrderDto,
    userId?: string,
    userEmail?: string
  ): Promise<PurchaseOrder> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.findOne(id, businessId);

      if (order.status === 'received') {
        throw new BadRequestException('Order is already received');
      }

      if (order.status === 'cancelled') {
        throw new BadRequestException('Cannot receive a cancelled order');
      }

      order.status = 'received';
      order.receivedDate = receiveDto.receivedDate || new Date();

      if (receiveDto.notes) {
        order.notes = receiveDto.notes;
      }

      const savedOrder = await queryRunner.manager.save(order);

      // AUTO: Increase stock for each received item
      if (receiveDto.items && receiveDto.items.length > 0) {
        for (const item of receiveDto.items) {
          const product = await this.productRepository.findOne({
            where: { id: item.productId, businessId },
          });

          if (product) {
            // Increase product stock
            product.quantity += item.quantity;
            await queryRunner.manager.save(product);

            // Create stock movement record (IN - Purchase)
            const stockMovement = this.stockMovementRepository.create({
              productId: item.productId,
              type: 'IN',
              quantity: item.quantity,
              reason: 'purchase',
              notes: `Purchase from ${order.supplierName} (PO)`,
              referenceId: savedOrder.id,
              businessId,
              date: new Date(),
            });
            await queryRunner.manager.save(stockMovement);
          }
        }
      }

      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        'system',
        'system@localhost',
        'received_purchase_order',
        'PurchaseOrder',
        savedOrder.id,
        {
          supplierName: savedOrder.supplierName,
          totalAmount: savedOrder.totalAmount,
          itemCount: receiveDto.items?.length || 0,
        },
        businessId,
      );

      // Create notification for received order
      try {
        await this.notificationService.create(
          businessId,
          'Purchase Order Received',
          `Order from ${savedOrder.supplierName} received. Stock updated automatically.`,
          'success',
          'purchase_order',
          `/purchase-orders/${savedOrder.id}`,
          savedOrder.id,
          'PurchaseOrder',
        );
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(id: string, businessId: string, userId?: string, userEmail?: string): Promise<PurchaseOrder> {
    const order = await this.findOne(id, businessId);

    if (order.status === 'received') {
      throw new BadRequestException('Cannot cancel a received order');
    }

    order.status = 'cancelled';
    const savedOrder = await this.purchaseOrderRepository.save(order);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'cancelled_purchase_order',
      'PurchaseOrder',
      savedOrder.id,
      {
        supplierName: savedOrder.supplierName,
        totalAmount: savedOrder.totalAmount,
      },
      businessId,
    );

    return savedOrder;
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const order = await this.findOne(id, businessId);
    
    // Log audit before deletion
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'deleted_purchase_order',
      'PurchaseOrder',
      order.id,
      {
        supplierName: order.supplierName,
        totalAmount: order.totalAmount,
      },
      businessId,
    );

    await this.purchaseOrderRepository.remove(order);
  }
}
