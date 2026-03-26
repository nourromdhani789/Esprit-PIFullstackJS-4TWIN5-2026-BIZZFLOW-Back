import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
  ) {}

  async create(businessId: string, createProductDto: CreateProductDto): Promise<Product> {
    const { initialQuantity, minimumStock, ...productData } = createProductDto;
    
    const product = this.productRepository.create({
      ...productData,
      quantity: initialQuantity || 0,
      minimumStock: minimumStock || 0,
      businessId,
    });
    
    const savedProduct = await this.productRepository.save(product);
    
    // Create initial stock movement if quantity provided
    if (initialQuantity && initialQuantity > 0) {
      const movement = this.stockMovementRepository.create({
        productId: savedProduct.id,
        type: 'IN',
        quantity: initialQuantity,
        reason: 'initial',
        notes: 'Initial stock setup',
        date: new Date(),
        businessId,
      });
      await this.stockMovementRepository.save(movement);
    }
    
    return savedProduct;
  }

  async findAll(businessId: string): Promise<Product[]> {
    // If no businessId, return all products (for backwards compatibility)
    if (!businessId) {
      return this.productRepository.find({
        order: { createdAt: 'DESC' },
      });
    }
    
    return this.productRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id, businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, businessId: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id, businessId);
    Object.assign(product, updateProductDto);
    return this.productRepository.save(product);
  }

  async remove(id: string, businessId: string): Promise<void> {
    const product = await this.findOne(id, businessId);
    await this.productRepository.remove(product);
  }
}
