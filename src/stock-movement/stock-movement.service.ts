import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { Product } from '../product/entities/product.entity';
import { CreateStockMovementDto, UpdateStockMovementDto, StockMovementFilterDto } from './dto/stock-movement.dto';

@Injectable()
export class StockMovementService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(businessId: string, createDto: CreateStockMovementDto): Promise<StockMovement> {
    const product = await this.productRepository.findOne({
      where: { id: createDto.productId, businessId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate stock for OUT movements
    if (createDto.type === 'OUT') {
      if (product.quantity < createDto.quantity) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${product.quantity}, Requested: ${createDto.quantity}`
        );
      }
    }

    // Create movement
    const movement = this.stockMovementRepository.create({
      ...createDto,
      businessId,
      date: createDto.date || new Date(),
    });

    const savedMovement = await this.stockMovementRepository.save(movement);

    // Update product stock
    if (createDto.type === 'IN') {
      product.quantity += createDto.quantity;
    } else {
      product.quantity -= createDto.quantity;
    }

    await this.productRepository.save(product);

    return savedMovement;
  }

  async findAll(businessId: string, filters?: StockMovementFilterDto): Promise<StockMovement[]> {
    const query = this.stockMovementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.product', 'product')
      .where('movement.businessId = :businessId', { businessId })
      .orderBy('movement.date', 'DESC');

    if (filters?.type) {
      query.andWhere('movement.type = :type', { type: filters.type });
    }

    if (filters?.productId) {
      query.andWhere('movement.productId = :productId', { productId: filters.productId });
    }

    if (filters?.startDate) {
      query.andWhere('movement.date >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('movement.date <= :endDate', { endDate: filters.endDate });
    }

    return query.getMany();
  }

  async findOne(id: string, businessId: string): Promise<StockMovement> {
    const movement = await this.stockMovementRepository.findOne({
      where: { id, businessId },
      relations: ['product'],
    });

    if (!movement) {
      throw new NotFoundException('Stock movement not found');
    }

    return movement;
  }

  async getProductStockHistory(productId: string, businessId: string): Promise<StockMovement[]> {
    return this.stockMovementRepository.find({
      where: { productId, businessId },
      order: { date: 'DESC' },
      relations: ['product'],
    });
  }

  async getLowStockProducts(businessId: string): Promise<Product[]> {
    return this.productRepository.find({
      where: { businessId },
      select: ['id', 'name', 'quantity', 'minimumStock', 'price'],
    }).then(products => 
      products.filter(p => p.quantity <= p.minimumStock)
    );
  }
}
