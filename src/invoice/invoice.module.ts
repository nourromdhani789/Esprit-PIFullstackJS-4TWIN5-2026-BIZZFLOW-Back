import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Business } from '../business/entities/business.entity';
import { Client } from '../client/entities/client.entity';
import { ClientModule } from '../client/client.module';
import { PdfService } from './services/pdf.service';
import { EmailService } from '../shared/services/email.service';
import { AiScannerService } from '../expense/services/ai-scanner.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { InvoiceSchedulerService } from './services/invoice-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Cash, Product, StockMovement, Business, Client]), ClientModule, AuditModule, NotificationModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, PdfService, EmailService, AiScannerService, InvoiceSchedulerService],
  exports: [InvoiceService, EmailService],
})
export class InvoiceModule {}
