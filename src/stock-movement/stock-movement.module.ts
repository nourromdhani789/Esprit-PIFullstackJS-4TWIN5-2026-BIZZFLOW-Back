import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockMovementService } from './stock-movement.service';
import { StockMovementController } from './stock-movement.controller';
import { StockMovement } from './entities/stock-movement.entity';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockMovement, Product])],
  controllers: [StockMovementController],
  providers: [StockMovementService],
  exports: [StockMovementService],
})
export class StockMovementModule {}
