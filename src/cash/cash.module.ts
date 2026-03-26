import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashService } from './cash.service';
import { CashController } from './cash.controller';
import { Cash } from './entities/cash.entity';
import { Payment } from '../payment/entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cash, Payment])],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
