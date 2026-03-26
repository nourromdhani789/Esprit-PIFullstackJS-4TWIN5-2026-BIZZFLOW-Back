import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cash } from './entities/cash.entity';
import { Payment } from '../payment/entities/payment.entity';

@Injectable()
export class CashService {
  constructor(
    @InjectRepository(Cash)
    private readonly cashRepository: Repository<Cash>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async getOrCreateCash(businessId: string): Promise<Cash> {
    let cash = await this.cashRepository.findOne({
      where: { businessId },
    });

    if (!cash) {
      cash = this.cashRepository.create({
        businessId,
        currentBalance: 0,
      });
      cash = await this.cashRepository.save(cash);
    }

    return cash;
  }

  // Calculate balance dynamically from all payments
  async getBalance(businessId: string): Promise<number> {
    const payments = await this.paymentRepository.find({
      where: { businessId },
    });

    let balance = 0;
    for (const payment of payments) {
      const amount = Number(payment.amount);
      if (payment.type === 'IN') {
        balance += amount;
      } else {
        balance -= amount;
      }
    }

    return balance;
  }

  async updateBalance(businessId: string, amount: number, type: 'IN' | 'OUT'): Promise<Cash> {
    const cash = await this.getOrCreateCash(businessId);

    if (type === 'IN') {
      cash.currentBalance += amount;
    } else {
      if (cash.currentBalance < amount) {
        throw new NotFoundException('Insufficient cash balance');
      }
      cash.currentBalance -= amount;
    }

    return this.cashRepository.save(cash);
  }

  async getCashDetails(businessId: string): Promise<Cash> {
    const cash = await this.getOrCreateCash(businessId);
    // Calculate real balance from payments
    cash.currentBalance = await this.getBalance(businessId);
    return cash;
  }
}
