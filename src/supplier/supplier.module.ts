import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { Supplier } from './entities/supplier.entity';
import { Expense } from '../expense/entities/expense.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, Expense, PurchaseOrder, Payment]), AuditModule],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
