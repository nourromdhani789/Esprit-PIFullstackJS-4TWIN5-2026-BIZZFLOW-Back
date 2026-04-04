import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { CreateExpenseDto, UpdateExpenseDto, ApproveExpenseDto } from './dto/expense.dto';
import { Supplier } from '../supplier/entities/supplier.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Cash)
    private readonly cashRepository: Repository<Cash>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(businessId: string, createExpenseDto: CreateExpenseDto, userId?: string, userEmail?: string): Promise<Expense> {
    // Validate supplier if provided
    if (createExpenseDto.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: createExpenseDto.supplierId, businessId },
      });
      if (!supplier) {
        throw new BadRequestException('Supplier not found or does not belong to your business');
      }
    }

    const expense = this.expenseRepository.create({
      ...createExpenseDto,
      businessId,
      date: new Date(createExpenseDto.date),
    });
    const savedExpense = await this.expenseRepository.save(expense);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'created_expense',
      'Expense',
      savedExpense.id,
      {
        amount: savedExpense.amount,
        category: savedExpense.category,
        supplierId: savedExpense.supplierId,
      },
      businessId,
    );

    return savedExpense;
  }

  async findAll(businessId: string, status?: string): Promise<Expense[]> {
    const where: any = { businessId };
    if (status) {
      where.status = status;
    }
    return await this.expenseRepository.find({
      where,
      relations: ['supplier'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, businessId: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id, businessId },
      relations: ['supplier'],
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(id: string, businessId: string, updateExpenseDto: UpdateExpenseDto, userId?: string, userEmail?: string): Promise<Expense> {
    const expense = await this.findOne(id, businessId);

    // Validate supplier if being updated
    if (updateExpenseDto.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: updateExpenseDto.supplierId, businessId },
      });
      if (!supplier) {
        throw new BadRequestException('Supplier not found or does not belong to your business');
      }
    }

    if (updateExpenseDto.date) {
      updateExpenseDto.date = new Date(updateExpenseDto.date) as any;
    }

    Object.assign(expense, updateExpenseDto);
    const savedExpense = await this.expenseRepository.save(expense);

    // Log audit
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'updated_expense',
      'Expense',
      savedExpense.id,
      {
        amount: savedExpense.amount,
        category: savedExpense.category,
        changes: Object.keys(updateExpenseDto),
      },
      businessId,
    );

    return savedExpense;
  }

  async remove(id: string, businessId: string, userId?: string, userEmail?: string): Promise<void> {
    const expense = await this.findOne(id, businessId);
    
    // Log audit before deletion
    await this.auditService.log(
      userId || 'system',
      userEmail || 'system@localhost',
      'deleted_expense',
      'Expense',
      expense.id,
      {
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
      },
      businessId,
    );

    await this.expenseRepository.remove(expense);
  }

  async approve(
    id: string, 
    businessId: string, 
    approveDto: ApproveExpenseDto,
    userRole: string
  ): Promise<Expense> {
    // Only admin, owner, or accountant can approve
    if (userRole !== 'PLATFORM_ADMIN' && userRole !== 'BUSINESS_OWNER' && userRole !== 'BUSINESS_ADMIN' && userRole !== 'ACCOUNTANT') {
      throw new ForbiddenException('Only admin, owner, or accountant can approve expenses');
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

        // Sync cash balance with payments before checking
        const payments = await this.paymentRepository.find({ where: { businessId } });
        let calculatedBalance = 0;
        for (const p of payments) {
          const amount = Number(p.amount);
          if (p.type === 'IN') {
            calculatedBalance += amount;
          } else {
            calculatedBalance -= amount;
          }
        }
        if (cash.currentBalance !== calculatedBalance) {
          cash.currentBalance = calculatedBalance;
          await queryRunner.manager.save(cash);
        }
        
        // Check sufficient balance
        if (cash.currentBalance < Number(expense.amount)) {
          throw new ForbiddenException(`Insufficient cash balance. Available: $${cash.currentBalance.toFixed(2)}, Required: $${Number(expense.amount).toFixed(2)}`);
        }
        
        cash.currentBalance -= Number(expense.amount);
        await queryRunner.manager.save(cash);
      }

      await queryRunner.commitTransaction();

      // Log audit for status change
      const action = approveDto.status === 'approved' ? 'approved_expense' : 
                      approveDto.status === 'rejected' ? 'rejected_expense' : 
                      `changed_expense_status_${approveDto.status}`;
      
      await this.auditService.log(
        'system',
        'system@localhost',
        action,
        'Expense',
        savedExpense.id,
        {
          amount: savedExpense.amount,
          category: savedExpense.category,
          previousStatus,
          newStatus: approveDto.status,
        },
        businessId,
      );

      // Create notification for approved expense
      if (approveDto.status === 'approved' && previousStatus !== 'approved') {
        try {
          await this.notificationService.create(
            businessId,
            'Expense Approved',
            `Expense of TND ${Number(savedExpense.amount).toFixed(3)} has been approved`,
            'success',
            'expense',
            `/expenses/${savedExpense.id}`,
            savedExpense.id,
            'Expense',
          );
        } catch (err) {
          console.error('Failed to create notification:', err);
        }
      }

      return savedExpense;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
