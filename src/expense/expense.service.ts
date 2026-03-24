import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto, UpdateExpenseDto, ApproveExpenseDto } from './dto/expense.dto';

@Injectable()
export class ExpenseService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
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
    if (userRole !== 'admin' && userRole !== 'owner') {
      throw new ForbiddenException('Only admin or owner can approve expenses');
    }

    const expense = await this.findOne(id, businessId);
    expense.status = approveDto.status;
    return await this.expenseRepository.save(expense);
  }
}
