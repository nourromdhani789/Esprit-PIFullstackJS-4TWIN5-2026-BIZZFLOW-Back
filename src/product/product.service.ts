import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private stockMovementRepository: Repository<StockMovement>,
    private auditService: AuditService,
    private notificationService: NotificationService,
  ) {}

  async create(businessId: string, createProductDto: CreateProductDto, userId?: string, userEmail?: string): Promise<Product> {
    const { initialQuantity, minimumStock, ...productData } = createProductDto;
    
    const product = this.productRepository.create({
      ...productData,
      quantity: initialQuantity || 0,
      minimumStock: minimumStock || 0,
      businessId,
    });
    
    const savedProduct = await this.productRepository.save(product);
    
    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'created_product',
      'Product',
      savedProduct.id,
      {
        name: savedProduct.name,
        price: savedProduct.price,
        quantity: savedProduct.quantity,
        productType: savedProduct.productType,
      },
      businessId,
    );
    
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

  async update(id: string, businessId: string, updateProductDto: UpdateProductDto, userId?: string, userEmail?: string): Promise<Product> {
    const product = await this.findOne(id, businessId);
    const previousPrice = product.price;
    const previousQuantity = product.quantity;
    
    Object.assign(product, updateProductDto);
    const savedProduct = await this.productRepository.save(product);

    // Log audit
    const details: any = {
      name: savedProduct.name,
    };
    
    if (updateProductDto.price !== undefined && updateProductDto.price !== previousPrice) {
      details.priceChanged = true;
      details.previousPrice = previousPrice;
      details.newPrice = savedProduct.price;
    }
    
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'updated_product',
      'Product',
      savedProduct.id,
      details,
      businessId,
    );

    return savedProduct;
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const product = await this.findOne(id, businessId);
    
    // Log audit before deletion
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'deleted_product',
      'Product',
      product.id,
      {
        name: product.name,
        quantity: product.quantity,
      },
      businessId,
    );

    await this.productRepository.remove(product);
  }

  async findForSales(businessId: string): Promise<Product[]> {
    return this.productRepository.find({
      where: [
        { businessId, usedFor: 'sales' },
        { businessId, usedFor: 'both' },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  async findForPurchases(businessId: string): Promise<Product[]> {
    return this.productRepository.find({
      where: [
        { businessId, usedFor: 'purchases' },
        { businessId, usedFor: 'both' },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check stock levels and send notifications if needed
   * This should be called whenever stock changes
   */
  async checkStockAndNotify(product: Product): Promise<void> {
    try {
      // Skip if no minimum stock is set or product doesn't track stock
      if (product.minimumStock === null || product.minimumStock === undefined) {
        return;
      }

      const quantity = product.quantity || 0;
      const minimumStock = product.minimumStock || 0;

      // Out of stock - critical
      if (quantity === 0) {
        await this.notificationService.create(
          product.businessId,
          'Out of Stock',
          `${product.name} is completely out of stock`,
          'error',
          'stock',
          `/products/${product.id}`,
          product.id,
          'Product',
        );
      }
      // Low stock warning
      else if (quantity < minimumStock) {
        await this.notificationService.create(
          product.businessId,
          'Low Stock Alert',
          `${product.name} is below minimum stock. Available: ${quantity}, Minimum: ${minimumStock}`,
          'warning',
          'stock',
          `/products/${product.id}`,
          product.id,
          'Product',
        );
      }
    } catch (err) {
      // Notification failure should not fail the main operation
      console.error('Failed to create stock notification:', err);
    }
  }
}
