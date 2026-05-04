import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';
import { AiScannerService } from './services/ai-scanner.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExpenseDto, UpdateExpenseDto, ApproveExpenseDto } from './dto/expense.dto';
import { BadRequestException } from '@nestjs/common';

describe('ExpenseController', () => {
  let controller: ExpenseController;
  let service: ExpenseService;

  const mockExpenseService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    approve: jest.fn(),
  };

  const mockAiScannerService = {
    scanReceipt: jest.fn(),
  };

  const mockExpense = {
    id: 'expense-1',
    amount: 150.50,
    category: 'Office Supplies',
    date: '2024-01-15',
    status: 'pending' as const,
    description: 'Printer paper',
    businessId: 'business-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = {
    user: {
      id: 'user-1',
      email: 'user@test.com',
      businessId: 'business-1',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpenseController],
      providers: [
        {
          provide: ExpenseService,
          useValue: mockExpenseService,
        },
        {
          provide: AiScannerService,
          useValue: mockAiScannerService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExpenseController>(ExpenseController);
    service = module.get<ExpenseService>(ExpenseService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new expense', async () => {
      const createDto: CreateExpenseDto = {
        amount: 200,
        category: 'Travel',
        date: '2024-01-15',
        description: 'Business trip',
        supplierId: 'supplier-1',
      };

      mockExpenseService.create.mockResolvedValue(mockExpense);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockExpense);
      expect(service.create).toHaveBeenCalledWith('business-1', createDto, 'user-1', 'user@test.com');
    });

    it('should create expense with minimal data', async () => {
      const minimalDto: CreateExpenseDto = {
        amount: 50,
        category: 'Miscellaneous',
        date: '2024-01-15',
      };

      const minimalExpense = { ...mockExpense, ...minimalDto };
      mockExpenseService.create.mockResolvedValue(minimalExpense);

      const result = await controller.create(minimalDto, mockRequest);

      expect(result.amount).toBe(50);
    });
  });

  describe('findAll', () => {
    it('should return all expenses for business', async () => {
      const expenses = [mockExpense, { ...mockExpense, id: 'expense-2', amount: 300 }];
      mockExpenseService.findAll.mockResolvedValue(expenses);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual(expenses);
      expect(service.findAll).toHaveBeenCalledWith('business-1', undefined);
    });

    it('should return expenses with status filter', async () => {
      const pendingExpenses = [{ ...mockExpense, status: 'pending' as const }];
      mockExpenseService.findAll.mockResolvedValue(pendingExpenses);

      const result = await controller.findAll(mockRequest, 'pending');

      expect(result).toEqual(pendingExpenses);
      expect(service.findAll).toHaveBeenCalledWith('business-1', 'pending');
    });

    it('should return empty array when no expenses', async () => {
      mockExpenseService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single expense by id', async () => {
      mockExpenseService.findOne.mockResolvedValue(mockExpense);

      const result = await controller.findOne('expense-1', mockRequest);

      expect(result).toEqual(mockExpense);
      expect(service.findOne).toHaveBeenCalledWith('expense-1', 'business-1');
    });

    it('should throw error when expense not found', async () => {
      mockExpenseService.findOne.mockRejectedValue(new Error('Expense not found'));

      await expect(controller.findOne('nonexistent', mockRequest)).rejects.toThrow('Expense not found');
    });
  });

  describe('update', () => {
    it('should update an expense', async () => {
      const updateDto: UpdateExpenseDto = {
        amount: 250,
        description: 'Updated description',
      };

      const updatedExpense = { ...mockExpense, ...updateDto };
      mockExpenseService.update.mockResolvedValue(updatedExpense);

      const result = await controller.update('expense-1', updateDto, mockRequest);

      expect(result).toEqual(updatedExpense);
      expect(service.update).toHaveBeenCalledWith('expense-1', 'business-1', updateDto, 'user-1', 'user@test.com');
    });

    it('should update expense status', async () => {
      const statusUpdate: UpdateExpenseDto = {
        status: 'approved' as const,
      };

      const approvedExpense = { ...mockExpense, status: 'approved' as const };
      mockExpenseService.update.mockResolvedValue(approvedExpense);

      const result = await controller.update('expense-1', statusUpdate, mockRequest);

      expect(result.status).toBe('approved');
    });
  });

  describe('remove', () => {
    it('should remove an expense', async () => {
      mockExpenseService.remove.mockResolvedValue(undefined);

      await controller.remove('expense-1', mockRequest);

      expect(service.remove).toHaveBeenCalledWith('expense-1', 'business-1', 'user-1', 'user@test.com');
    });

    it('should throw error when removing non-existent expense', async () => {
      mockExpenseService.remove.mockRejectedValue(new Error('Expense not found'));

      await expect(controller.remove('nonexistent', mockRequest)).rejects.toThrow('Expense not found');
    });
  });

  describe('approve', () => {
    it('should approve an expense', async () => {
      const approveDto: ApproveExpenseDto = { status: 'approved' };
      const approvedExpense = { ...mockExpense, status: 'approved' as const };
      mockExpenseService.approve.mockResolvedValue(approvedExpense);

      const result = await controller.approve('expense-1', approveDto, mockRequest);

      expect(result.status).toBe('approved');
      expect(service.approve).toHaveBeenCalledWith('expense-1', 'business-1', approveDto, 'user');
    });

    it('should reject an expense', async () => {
      const rejectDto: ApproveExpenseDto = { status: 'rejected' };
      const rejectedExpense = { ...mockExpense, status: 'rejected' as const };
      mockExpenseService.approve.mockResolvedValue(rejectedExpense);

      const result = await controller.approve('expense-1', rejectDto, mockRequest);

      expect(result.status).toBe('rejected');
    });
  });

  describe('uploadReceipt', () => {
    it('should upload receipt and scan', async () => {
      const mockFile = {
        filename: 'receipt-123.pdf',
        path: '/uploads/receipts/receipt-123.pdf',
      } as Express.Multer.File;

      const aiResult = {
        amount: 150.50,
        date: '2024-01-15',
        supplier: 'Office Depot',
        confidence: 0.95,
      };
      mockAiScannerService.scanReceipt.mockResolvedValue(aiResult);

      const result = await controller.uploadReceipt(mockFile, mockRequest);

      expect(result.receiptUrl).toBe('/uploads/receipts/receipt-123.pdf');
      expect(result.aiExtracted).toEqual(aiResult);
      expect(mockAiScannerService.scanReceipt).toHaveBeenCalledWith(mockFile);
    });

    it('should throw BadRequestException when no file uploaded', async () => {
      await expect(controller.uploadReceipt(undefined as any, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });
});
