import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderController } from './sales-order.controller';
import { SalesOrderPdfService } from './sales-order-pdf.service';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { Client } from '../client/entities/client.entity';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { EmailService } from '../shared/services/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalesOrder, SalesOrderItem, Client, Business, Product, StockMovement]),
    AuditModule,
    NotificationModule,
    InvoiceModule,
  ],
  controllers: [SalesOrderController],
  providers: [SalesOrderService, SalesOrderPdfService, EmailService],
  exports: [SalesOrderService],
})
export class SalesOrderModule {}
