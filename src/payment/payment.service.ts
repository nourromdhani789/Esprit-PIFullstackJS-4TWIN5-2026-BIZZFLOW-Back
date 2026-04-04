import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { CreatePaymentDto, UpdatePaymentDto, PaymentFilterDto } from './dto/payment.dto';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Cash)
    private readonly cashRepository: Repository<Cash>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(businessId: string, createDto: CreatePaymentDto, userId?: string, userEmail?: string): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create payment
      const payment = this.paymentRepository.create({
        ...createDto,
        businessId,
        date: createDto.date || new Date(),
      });

      const savedPayment = await queryRunner.manager.save(payment);

      // Update cash balance
      let cash = await this.cashRepository.findOne({ where: { businessId } });
      
      if (!cash) {
        cash = this.cashRepository.create({
          businessId,
          currentBalance: 0,
        });
      }

      if (createDto.type === 'IN') {
        cash.currentBalance += createDto.amount;
      } else {
        if (cash.currentBalance < createDto.amount) {
          throw new NotFoundException(`Insufficient cash balance. Available: $${cash.currentBalance.toFixed(2)}, Required: $${createDto.amount.toFixed(2)}`);
        }
        cash.currentBalance -= createDto.amount;
      }

      await queryRunner.manager.save(cash);
      await queryRunner.commitTransaction();

      // Log audit
      await this.auditService.log(
        userId || 'system',
        userEmail || 'system@localhost',
        createDto.type === 'IN' ? 'recorded_payment_in' : 'recorded_payment_out',
        'Payment',
        savedPayment.id,
        {
          amount: savedPayment.amount,
          type: savedPayment.type,
          method: savedPayment.method,
          description: savedPayment.description,
          referenceId: savedPayment.referenceId,
          referenceType: savedPayment.referenceType,
          newCashBalance: cash.currentBalance,
        },
        businessId,
      );

      // Create notification for payment
      try {
        const title = createDto.type === 'IN' ? 'Payment Received' : 'Payment Sent';
        const message = createDto.type === 'IN' 
          ? `Payment of TND ${Number(savedPayment.amount).toFixed(3)} received - ${savedPayment.description || 'No description'}`
          : `Payment of TND ${Number(savedPayment.amount).toFixed(3)} sent - ${savedPayment.description || 'No description'}`;
        await this.notificationService.create(
          businessId,
          title,
          message,
          createDto.type === 'IN' ? 'success' : 'warning',
          'payment',
          `/payments/${savedPayment.id}`,
          savedPayment.id,
          'Payment',
        );
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      return savedPayment;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(businessId: string, filters?: PaymentFilterDto): Promise<Payment[]> {
    const query = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.businessId = :businessId', { businessId })
      .orderBy('payment.date', 'DESC');

    if (filters?.type) {
      query.andWhere('payment.type = :type', { type: filters.type });
    }

    if (filters?.method) {
      query.andWhere('payment.method = :method', { method: filters.method });
    }

    if (filters?.startDate) {
      query.andWhere('payment.date >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('payment.date <= :endDate', { endDate: filters.endDate });
    }

    return query.getMany();
  }

  async findOne(id: string, businessId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id, businessId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async update(id: string, businessId: string, updateDto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.findOne(id, businessId);
    Object.assign(payment, updateDto);
    return this.paymentRepository.save(payment);
  }

  async remove(id: string, businessId: string): Promise<void> {
    const payment = await this.findOne(id, businessId);
    await this.paymentRepository.remove(payment);
  }
}
