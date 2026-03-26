import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PurchaseOrder, Product, StockMovement])],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
