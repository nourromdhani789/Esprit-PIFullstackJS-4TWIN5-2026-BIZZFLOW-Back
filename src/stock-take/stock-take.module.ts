import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTakeService } from './stock-take.service';
import { StockTakeController } from './stock-take.controller';
import { StockTake } from './entities/stock-take.entity';
import { StockTakeItem } from './entities/stock-take-item.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([StockTake, StockTakeItem, Product, StockMovement]), AuditModule],
  controllers: [StockTakeController],
  providers: [StockTakeService],
  exports: [StockTakeService],
})
export class StockTakeModule {}
