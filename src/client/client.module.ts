import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { Client } from './entities/client.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { CreditNote } from '../credit-note/entities/credit-note.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Client, Invoice, CreditNote, Payment]), AuditModule],
  controllers: [ClientController],
  providers: [ClientService],
  exports: [ClientService],
})
export class ClientModule {}
