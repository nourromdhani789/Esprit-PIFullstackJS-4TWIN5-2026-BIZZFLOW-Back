import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { CreateExpenseDto, UpdateExpenseDto, ApproveExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Cash)
    private readonly cashRepository: Repository<Cash>,
    private readonly dataSource: DataSource,
  ) {}

  async create(businessId: string, createExpenseDto: CreateExpenseDto): Promise<Expense> {
    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      businessId,
      date: new Date(createExpenseDto.date),
    });
    return await this.expenseRepository.save(expense);
  }

  async findAll(businessId: string, status?: string): Promise<Expense[]> {
    const where: any = { businessId };
    if (status) {
      where.status = status;
    }
    return await this.expenseRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id, businessId },
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(id: string, businessId: string, updateExpenseDto: UpdateExpenseDto): Promise<Expense> {
    const expense = await this.findOne(id, businessId);
    
    if (updateExpenseDto.date) {
      updateExpenseDto.date = new Date(updateExpenseDto.date) as any;
    }
    
    Object.assign(expense, updateExpenseDto);
    return await this.expenseRepository.save(expense);
  }

  async remove(id: string, businessId: string): Promise<void> {
    const expense = await this.findOne(id, businessId);
    await this.expenseRepository.remove(expense);
  }

  async approve(
    id: string, 
    businessId: string, 
    approveDto: ApproveExpenseDto,
    userRole: string
  ): Promise<Expense> {
    // Only admin or business owner can approve
    if (userRole !== 'PLATFORM_ADMIN' && userRole !== 'BUSINESS_OWNER' && userRole !== 'BUSINESS_ADMIN') {
      throw new ForbiddenException('Only admin or owner can approve expenses');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const expense = await this.findOne(id, businessId);
      const previousStatus = expense.status;
      expense.status = approveDto.status;
      const savedExpense = await queryRunner.manager.save(expense);

      // AUTO: Create payment and decrease cash when expense is approved
      if (approveDto.status === 'approved' && previousStatus !== 'approved') {
        // Create payment record (Money OUT)
        const payment = this.paymentRepository.create({
          type: 'OUT',
          amount: expense.amount,
          method: 'transfer',
          description: `Expense: ${expense.category} - ${expense.description || 'No description'}`,
          referenceId: expense.id,
          referenceType: 'expense',
          date: new Date(),
          businessId,
        });
        await queryRunner.manager.save(payment);

        // Update cash balance (decrease)
        let cash = await this.cashRepository.findOne({ where: { businessId } });
        if (!cash) {
          cash = this.cashRepository.create({
            businessId,
            currentBalance: 0,
          });
        }
        
        // Check sufficient balance
        if (cash.currentBalance < Number(expense.amount)) {
          throw new ForbiddenException('Insufficient cash balance for this expense');
        }
        
        cash.currentBalance -= Number(expense.amount);
        await queryRunner.manager.save(cash);
      }

      await queryRunner.commitTransaction();
      return savedExpense;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
