import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { Expense } from './entities/expense.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { AiScannerService } from './services/ai-scanner.service';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, Payment, Cash])],
  controllers: [ExpenseController],
  providers: [ExpenseService, AiScannerService],
  exports: [ExpenseService],
})
export class ExpenseModule {}
