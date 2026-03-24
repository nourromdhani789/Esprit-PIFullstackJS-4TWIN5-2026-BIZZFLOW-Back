import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Expense } from '../expense/entities/expense.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Expense])],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
