import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditNoteService } from './credit-note.service';
import { CreditNoteController } from './credit-note.controller';
import { CreditNote } from './entities/credit-note.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CreditNote, Payment, Cash])],
  controllers: [CreditNoteController],
  providers: [CreditNoteService],
  exports: [CreditNoteService],
})
export class CreditNoteModule {}
