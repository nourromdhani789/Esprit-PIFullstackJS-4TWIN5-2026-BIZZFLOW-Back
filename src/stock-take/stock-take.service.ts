import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockTake, StockTakeStatus } from './entities/stock-take.entity';
import { StockTakeItem } from './entities/stock-take-item.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { CreateStockTakeDto, UpdateStockTakeDto, AddStockTakeItemDto, UpdateStockTakeItemDto, CompleteStockTakeDto } from './dto/stock-take.dto';

@Injectable()
export class StockTakeService {
  constructor(
    @InjectRepository(StockTake)
    private stockTakeRepository: Repository<StockTake>,
    @InjectRepository(StockTakeItem)
    private stockTakeItemRepository: Repository<StockTakeItem>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
  ) {}

  async create(businessId: string, dto: CreateStockTakeDto): Promise<StockTake> {
    const stockTake = this.stockTakeRepository.create({
      ...dto,
      status: 'draft',
      businessId,
    });
    return this.stockTakeRepository.save(stockTake);
  }

  async findAll(businessId: string): Promise<StockTake[]> {
    return this.stockTakeRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<StockTake> {
    const stockTake = await this.stockTakeRepository.findOne({
      where: { id, businessId },
    });
    if (!stockTake) {
      throw new NotFoundException('Stock take not found');
    }
    return stockTake;
  }

  async findWithItems(id: string, businessId: string): Promise<{ stockTake: StockTake; items: StockTakeItem[] }> {
    const stockTake = await this.findOne(id, businessId);
    const items = await this.stockTakeItemRepository.find({
      where: { stockTakeId: id, businessId },
      order: { productName: 'ASC' },
    });
    return { stockTake, items };
  }

  async update(id: string, businessId: string, dto: UpdateStockTakeDto): Promise<StockTake> {
    const stockTake = await this.findOne(id, businessId);
    Object.assign(stockTake, dto);
    return this.stockTakeRepository.save(stockTake);
  }

  async startStockTake(id: string, businessId: string): Promise<StockTake> {
    const stockTake = await this.findOne(id, businessId);
    
    if (stockTake.status !== 'draft') {
      throw new BadRequestException('Stock take must be in draft status to start');
    }

    // Load all products and create stock take items
    const products = await this.productRepository.find({
      where: { businessId },
    });

    for (const product of products) {
      const existingItem = await this.stockTakeItemRepository.findOne({
        where: { stockTakeId: id, productId: product.id },
      });

      if (!existingItem) {
        const item = this.stockTakeItemRepository.create({
          stockTakeId: id,
          productId: product.id,
          productName: product.name,
          systemQuantity: product.quantity || 0,
          businessId,
        });
        await this.stockTakeItemRepository.save(item);
      }
    }

    stockTake.status = 'in_progress';
    stockTake.totalProducts = products.length;
    stockTake.countDate = new Date();
    return this.stockTakeRepository.save(stockTake);
  }

  async addOrUpdateItem(
    stockTakeId: string,
    businessId: string,
    dto: AddStockTakeItemDto,
  ): Promise<StockTakeItem> {
    const stockTake = await this.findOne(stockTakeId, businessId);
    
    if (stockTake.status !== 'in_progress') {
      throw new BadRequestException('Stock take must be in progress to add items');
    }

    const product = await this.productRepository.findOne({
      where: { id: dto.productId, businessId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let item = await this.stockTakeItemRepository.findOne({
      where: { stockTakeId, productId: dto.productId },
    });

    if (item) {
      item.countedQuantity = dto.countedQuantity;
      item.difference = dto.countedQuantity - item.systemQuantity;
      item.notes = dto.notes;
    } else {
      item = this.stockTakeItemRepository.create({
        stockTakeId,
        productId: dto.productId,
        productName: product.name,
        systemQuantity: product.quantity || 0,
        countedQuantity: dto.countedQuantity,
        difference: dto.countedQuantity - (product.quantity || 0),
        notes: dto.notes,
        businessId,
      });
    }

    const savedItem = await this.stockTakeItemRepository.save(item);
    await this.updateStockTakeProgress(stockTakeId, businessId);
    return savedItem;
  }

  async updateItem(
    itemId: string,
    businessId: string,
    dto: UpdateStockTakeItemDto,
  ): Promise<StockTakeItem> {
    const item = await this.stockTakeItemRepository.findOne({
      where: { id: itemId, businessId },
    });

    if (!item) {
      throw new NotFoundException('Stock take item not found');
    }

    if (dto.countedQuantity !== undefined) {
      item.countedQuantity = dto.countedQuantity;
      item.difference = dto.countedQuantity - item.systemQuantity;
    }
    if (dto.notes !== undefined) {
      item.notes = dto.notes;
    }

    const savedItem = await this.stockTakeItemRepository.save(item);
    await this.updateStockTakeProgress(item.stockTakeId, businessId);
    return savedItem;
  }

  private async updateStockTakeProgress(stockTakeId: string, businessId: string): Promise<void> {
    const items = await this.stockTakeItemRepository.find({
      where: { stockTakeId, businessId },
    });

    const productsCounted = items.filter(i => i.countedQuantity !== null && i.countedQuantity !== undefined).length;
    const discrepancies = items.filter(i => i.difference !== 0).length;

    await this.stockTakeRepository.update(stockTakeId, {
      productsCounted,
      discrepancies,
    });
  }

  async completeStockTake(
    id: string,
    businessId: string,
    dto: CompleteStockTakeDto,
  ): Promise<{ stockTake: StockTake; adjustments: StockMovement[] }> {
    const { stockTake, items } = await this.findWithItems(id, businessId);

    if (stockTake.status !== 'in_progress') {
      throw new BadRequestException('Stock take must be in progress to complete');
    }

    const adjustments: StockMovement[] = [];

    if (dto.action === 'adjust') {
      // Create stock movements for discrepancies
      for (const item of items) {
        if (item.difference !== 0 && !item.isAdjusted) {
          const movement = this.stockMovementRepository.create({
            productId: item.productId,
            type: item.difference > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(item.difference),
            reason: 'adjustment',
            notes: `Stock take adjustment - ${stockTake.name}`,
            referenceId: id,
            date: new Date(),
            businessId,
          });
          const savedMovement = await this.stockMovementRepository.save(movement);
          adjustments.push(savedMovement);

          // Update product quantity
          const product = await this.productRepository.findOne({
            where: { id: item.productId, businessId },
          });
          if (product && item.countedQuantity !== undefined && item.countedQuantity !== null) {
            product.quantity = item.countedQuantity;
            await this.productRepository.save(product);
          }

          item.isAdjusted = true;
          await this.stockTakeItemRepository.save(item);
        }
      }
    }

    stockTake.status = 'completed';
    const savedStockTake = await this.stockTakeRepository.save(stockTake);

    return { stockTake: savedStockTake, adjustments };
  }

  async cancel(id: string, businessId: string): Promise<StockTake> {
    const stockTake = await this.findOne(id, businessId);
    
    if (stockTake.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed stock take');
    }

    stockTake.status = 'cancelled';
    return this.stockTakeRepository.save(stockTake);
  }

  async delete(id: string, businessId: string): Promise<void> {
    const stockTake = await this.findOne(id, businessId);
    await this.stockTakeRepository.remove(stockTake);
  }
}
