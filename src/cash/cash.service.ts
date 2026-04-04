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

  // Get balance from cash table, sync with payments if needed
  async getBalance(businessId: string): Promise<number> {
    const cash = await this.getOrCreateCash(businessId);
    
    // Calculate balance from payments to sync
    const payments = await this.paymentRepository.find({
      where: { businessId },
    });
    let calculatedBalance = 0;
    for (const payment of payments) {
      const amount = Number(payment.amount);
      if (payment.type === 'IN') {
        calculatedBalance += amount;
      } else {
        calculatedBalance -= amount;
      }
    }
    
    // Sync if different
    if (cash.currentBalance !== calculatedBalance) {
      cash.currentBalance = calculatedBalance;
      await this.cashRepository.save(cash);
    }
    
    return cash.currentBalance;
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
