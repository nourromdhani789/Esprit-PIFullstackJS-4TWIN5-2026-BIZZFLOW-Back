import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { Product } from './entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, StockMovement])],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
