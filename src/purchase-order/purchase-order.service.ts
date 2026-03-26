import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, ReceivePurchaseOrderDto } from './dto/purchase-order.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, createDto: CreatePurchaseOrderDto): Promise<PurchaseOrder> {
    const order = this.purchaseOrderRepository.create({
      ...createDto,
      businessId,
      date: createDto.date || new Date(),
      status: createDto.status || 'pending',
    });

    return this.purchaseOrderRepository.save(order);
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

  async update(id: string, businessId: string, updateDto: UpdatePurchaseOrderDto): Promise<PurchaseOrder> {
    const order = await this.findOne(id, businessId);

    // Prevent updating received orders
    if (order.status === 'received') {
      throw new BadRequestException('Cannot update a received order');
    }

    Object.assign(order, updateDto);
    return this.purchaseOrderRepository.save(order);
  }

  async markAsReceived(
    id: string, 
    businessId: string, 
    receiveDto: ReceivePurchaseOrderDto
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
      return savedOrder;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(id: string, businessId: string): Promise<PurchaseOrder> {
    const order = await this.findOne(id, businessId);

    if (order.status === 'received') {
      throw new BadRequestException('Cannot cancel a received order');
    }

    order.status = 'cancelled';
    return this.purchaseOrderRepository.save(order);
  }

  async remove(id: string, businessId: string): Promise<void> {
    const order = await this.findOne(id, businessId);
    await this.purchaseOrderRepository.remove(order);
  }
}
