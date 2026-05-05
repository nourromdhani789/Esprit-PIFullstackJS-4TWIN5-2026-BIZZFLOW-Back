import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseService } from './expense.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { CreateExpenseDto, UpdateExpenseDto, ApproveExpenseDto } from './dto/expense.dto';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let expenseRepository: Repository<Expense>;
  let auditService: AuditService;

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: { save: jest.fn() },
  };

  const mockExpenseRepository = {
    create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), remove: jest.fn(),
  };
  const mockPaymentRepository = { create: jest.fn(), find: jest.fn() };
  const mockCashRepository = { findOne: jest.fn(), create: jest.fn() };
  const mockSupplierRepository = { findOne: jest.fn() };
  const mockDataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const mockAuditService = { log: jest.fn() };
  const mockNotificationService = { create: jest.fn() };

  const mockExpense = {
    id: 'expense-1', amount: 500, category: 'Office Supplies', date: '2024-01-15',
    status: 'pending', description: 'Printer paper', supplierId: 'supplier-1',
    businessId: 'business-1', createdAt: new Date(), updatedAt: new Date(),
  };
  const mockSupplier = { id: 'supplier-1', name: 'Test Supplier', businessId: 'business-1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: getRepositoryToken(Expense), useValue: mockExpenseRepository },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        { provide: getRepositoryToken(Cash), useValue: mockCashRepository },
        { provide: getRepositoryToken(Supplier), useValue: mockSupplierRepository },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
    expenseRepository = module.get<Repository<Expense>>(getRepositoryToken(Expense));
    auditService = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
    queryRunner.manager.save.mockReset();
  });

  describe('create', () => {
    it('should create an expense', async () => {
      const createDto: CreateExpenseDto = { amount: 500, category: 'Office Supplies', date: '2024-01-15', description: 'Printer paper' };
      mockExpenseRepository.create.mockReturnValue(mockExpense);
      mockExpenseRepository.save.mockResolvedValue(mockExpense);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', createDto, 'user-1', 'user@test.com');
      expect(result).toEqual(mockExpense);
      expect(auditService.log).toHaveBeenCalledWith('user-1', 'user@test.com', 'created_expense', 'Expense', 'expense-1', expect.objectContaining({ amount: 500 }), 'business-1');
    });

    it('should create expense with valid supplier', async () => {
      const createDto: CreateExpenseDto = { amount: 300, category: 'Travel', date: '2024-01-15', supplierId: 'supplier-1' };
      mockSupplierRepository.findOne.mockResolvedValue(mockSupplier);
      mockExpenseRepository.create.mockReturnValue({ ...mockExpense, supplierId: 'supplier-1' });
      mockExpenseRepository.save.mockResolvedValue({ ...mockExpense, supplierId: 'supplier-1' });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', createDto);
      expect(result.supplierId).toBe('supplier-1');
    });

    it('should throw when supplier not found', async () => {
      const createDto: CreateExpenseDto = { amount: 300, category: 'Travel', date: '2024-01-15', supplierId: 'nonexistent' };
      mockSupplierRepository.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', createDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all expenses for business', async () => {
      mockExpenseRepository.find.mockResolvedValue([mockExpense]);
      const result = await service.findAll('business-1');
      expect(result).toEqual([mockExpense]);
    });

    it('should filter by status', async () => {
      mockExpenseRepository.find.mockResolvedValue([mockExpense]);
      const result = await service.findAll('business-1', 'pending');
      expect(expenseRepository.find).toHaveBeenCalledWith({ where: { businessId: 'business-1', status: 'pending' }, relations: ['supplier'], order: { createdAt: 'DESC' } });
    });
  });

  describe('findOne', () => {
    it('should return an expense by id', async () => {
      mockExpenseRepository.findOne.mockResolvedValue(mockExpense);
      const result = await service.findOne('expense-1', 'business-1');
      expect(result).toEqual(mockExpense);
    });

    it('should throw NotFoundException when not found', async () => {
      mockExpenseRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an expense', async () => {
      const updateDto: UpdateExpenseDto = { description: 'Updated' };
      mockExpenseRepository.findOne.mockResolvedValue({ ...mockExpense });
      mockExpenseRepository.save.mockImplementation(e => Promise.resolve(e));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('expense-1', 'business-1', updateDto, 'user-1', 'user@test.com');
      expect(result.description).toBe('Updated');
    });

    it('should validate supplier when updating', async () => {
      const updateDto: UpdateExpenseDto = { supplierId: 'nonexistent' };
      mockExpenseRepository.findOne.mockResolvedValue({ ...mockExpense });
      mockSupplierRepository.findOne.mockResolvedValue(null);
      await expect(service.update('expense-1', 'business-1', updateDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove an expense', async () => {
      mockExpenseRepository.findOne.mockResolvedValue({ ...mockExpense });
      mockExpenseRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
      await service.remove('expense-1', 'business-1', 'user-1', 'user@test.com');
      expect(expenseRepository.remove).toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('should reject non-authorized role', async () => {
      const approveDto: ApproveExpenseDto = { status: 'approved' };
      await expect(service.approve('expense-1', 'business-1', approveDto, 'user')).rejects.toThrow(ForbiddenException);
    });

    it('should approve expense as BUSINESS_OWNER', async () => {
      const approveDto: ApproveExpenseDto = { status: 'approved' };
      mockExpenseRepository.findOne.mockResolvedValue(mockExpense);
      queryRunner.manager.save.mockResolvedValue({ ...mockExpense, status: 'approved' });
      mockPaymentRepository.create.mockReturnValue({ type: 'OUT', amount: 500 });
      mockCashRepository.findOne.mockResolvedValue({ id: 'cash-1', businessId: 'business-1', currentBalance: 1000 });
      mockPaymentRepository.find.mockResolvedValue([{ type: 'IN', amount: 1000 }]);
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockResolvedValue(undefined);

      const result = await service.approve('expense-1', 'business-1', approveDto, 'BUSINESS_OWNER');
      expect(result.status).toBe('approved');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject expense', async () => {
      const rejectDto: ApproveExpenseDto = { status: 'rejected' };
      mockExpenseRepository.findOne.mockResolvedValue(mockExpense);
      queryRunner.manager.save.mockResolvedValue({ ...mockExpense, status: 'rejected' });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.approve('expense-1', 'business-1', rejectDto, 'BUSINESS_ADMIN');
      expect(result.status).toBe('rejected');
    });

    it('should throw when insufficient cash balance', async () => {
      const approveDto: ApproveExpenseDto = { status: 'approved' };
      mockExpenseRepository.findOne.mockResolvedValue(mockExpense);
      queryRunner.manager.save.mockResolvedValue({ ...mockExpense, status: 'approved' });
      mockPaymentRepository.create.mockReturnValue({ type: 'OUT', amount: 500 });
      mockCashRepository.findOne.mockResolvedValue({ id: 'cash-1', businessId: 'business-1', currentBalance: 100 });
      mockPaymentRepository.find.mockResolvedValue([{ type: 'OUT', amount: 200 }]);

      await expect(service.approve('expense-1', 'business-1', approveDto, 'ACCOUNTANT')).rejects.toThrow(ForbiddenException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should allow PLATFORM_ADMIN to approve', async () => {
      const approveDto: ApproveExpenseDto = { status: 'approved' };
      mockExpenseRepository.findOne.mockResolvedValue(mockExpense);
      queryRunner.manager.save.mockResolvedValue({ ...mockExpense, status: 'approved' });
      mockPaymentRepository.create.mockReturnValue({ type: 'OUT', amount: 500 });
      mockCashRepository.findOne.mockResolvedValue({ id: 'cash-1', businessId: 'business-1', currentBalance: 1000 });
      mockPaymentRepository.find.mockResolvedValue([{ type: 'IN', amount: 1000 }]);
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockResolvedValue(undefined);

      const result = await service.approve('expense-1', 'business-1', approveDto, 'PLATFORM_ADMIN');
      expect(result.status).toBe('approved');
    });
  });
});
