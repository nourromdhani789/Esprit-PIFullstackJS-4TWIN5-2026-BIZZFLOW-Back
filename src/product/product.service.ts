import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(businessId: string, createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create({
      ...createProductDto,
      businessId,
    });
    return this.productRepository.save(product);
  }

  async findAll(businessId: string): Promise<Product[]> {
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
