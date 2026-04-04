import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';
import { QuotePdfService } from './quote-pdf.service';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Client } from '../client/entities/client.entity';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { SalesOrderModule } from '../sales-order/sales-order.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { EmailService } from '../shared/services/email.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteItem, Client, Business, Product]),
    AuditModule,
    NotificationModule,
    SalesOrderModule,
    InvoiceModule,
  ],
  controllers: [QuoteController],
  providers: [QuoteService, QuotePdfService, EmailService],
  exports: [QuoteService],
})
export class QuoteModule {}
