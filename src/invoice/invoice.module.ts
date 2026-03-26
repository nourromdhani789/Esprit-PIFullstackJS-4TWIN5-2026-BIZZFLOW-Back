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
import { PdfService } from './services/pdf.service';
import { EmailService } from '../shared/services/email.service';

import { AiScannerService } from '../expense/services/ai-scanner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceItem, Payment, Cash, Product, StockMovement])],
  controllers: [InvoiceController],
  providers: [InvoiceService, PdfService, EmailService, AiScannerService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
