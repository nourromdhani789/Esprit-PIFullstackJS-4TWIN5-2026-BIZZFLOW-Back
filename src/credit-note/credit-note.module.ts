import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditNoteService } from './credit-note.service';
import { CreditNoteController } from './credit-note.controller';
import { CreditNote } from './entities/credit-note.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [TypeOrmModule.forFeature([CreditNote, Invoice, Payment, Cash]), AuditModule, NotificationModule],
  controllers: [CreditNoteController],
  providers: [CreditNoteService],
  exports: [CreditNoteService],
})
export class CreditNoteModule {}
