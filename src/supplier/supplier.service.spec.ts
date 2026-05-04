import { Test, TestingModule } from '@nestjs/testing';
import { SupplierService } from './supplier.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { Expense } from '../expense/entities/expense.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

describe('SupplierService', () => {
  let service: SupplierService;
  let supplierRepository: Repository<Supplier>;
  let expenseRepository: Repository<Expense>;
  let purchaseOrderRepository: Repository<PurchaseOrder>;
  let paymentRepository: Repository<Payment>;
  let auditService: AuditService;

  const mockSupplierRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockExpenseRepository = {
    find: jest.fn(),
  };

  const mockPurchaseOrderRepository = {
    find: jest.fn(),
  };

  const mockPaymentRepository = {
    find: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockSupplier = {
    id: 'supplier-1',
    name: 'Test Supplier',
    email: 'supplier@test.com',
    phone: '+1234567890',
    address: '123 Supplier St',
    businessId: 'business-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        {
          provide: getRepositoryToken(Supplier),
          useValue: mockSupplierRepository,
        },
        {
          provide: getRepositoryToken(Expense),
          useValue: mockExpenseRepository,
        },
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockPurchaseOrderRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
    supplierRepository = module.get<Repository<Supplier>>(getRepositoryToken(Supplier));
    expenseRepository = module.get<Repository<Expense>>(getRepositoryToken(Expense));
    purchaseOrderRepository = module.get<Repository<PurchaseOrder>>(getRepositoryToken(PurchaseOrder));
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a supplier', async () => {
      const createDto: CreateSupplierDto = {
        name: 'New Supplier',
        email: 'new@supplier.com',
        phone: '+1234567890',
      };

      mockSupplierRepository.create.mockReturnValue(mockSupplier);
      mockSupplierRepository.save.mockResolvedValue(mockSupplier);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', createDto, 'user-1', 'user@test.com');

      expect(result).toEqual(mockSupplier);
      expect(supplierRepository.create).toHaveBeenCalledWith({
        ...createDto,
        businessId: 'business-1',
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1', 'user@test.com', 'created_supplier', 'Supplier',
        'supplier-1', expect.objectContaining({ name: 'Test Supplier' }), 'business-1'
      );
    });

    it('should create supplier even if audit fails', async () => {
      const createDto: CreateSupplierDto = { name: 'Supplier', email: 's@test.com' };
      mockSupplierRepository.create.mockReturnValue(mockSupplier);
      mockSupplierRepository.save.mockResolvedValue(mockSupplier);
      mockAuditService.log.mockRejectedValue(new Error('Audit failed'));

      const result = await service.create('business-1', createDto);

      expect(result).toEqual(mockSupplier);
    });
  });

  describe('findAll', () => {
    it('should return suppliers with computed fields', async () => {
      mockSupplierRepository.find.mockResolvedValue([mockSupplier]);
      mockExpenseRepository.find.mockResolvedValue([
        { supplierId: 'supplier-1', amount: 500, status: 'approved', businessId: 'business-1' },
        { supplierId: 'supplier-1', amount: 300, status: 'pending', businessId: 'business-1' },
      ]);
      mockPurchaseOrderRepository.find.mockResolvedValue([
        { supplierId: 'supplier-1', businessId: 'business-1' },
      ]);

      const result = await service.findAll('business-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalPurchased).toBe(800);
      expect(result[0].totalPaid).toBe(500);
      expect(result[0].outstandingBalance).toBe(300);
      expect(result[0].expenseCount).toBe(2);
      expect(result[0].orderCount).toBe(1);
    });

    it('should return empty array when no suppliers', async () => {
      mockSupplierRepository.find.mockResolvedValue([]);

      const result = await service.findAll('business-1');

      expect(result).toEqual([]);
      expect(expenseRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a supplier by id', async () => {
      mockSupplierRepository.findOne.mockResolvedValue(mockSupplier);

      const result = await service.findOne('supplier-1', 'business-1');

      expect(result).toEqual(mockSupplier);
    });

    it('should throw NotFoundException when supplier not found', async () => {
      mockSupplierRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('should return comprehensive supplier profile', async () => {
      mockSupplierRepository.findOne.mockResolvedValue(mockSupplier);
      mockExpenseRepository.find.mockResolvedValue([
        { id: 'exp-1', supplierId: 'supplier-1', amount: 500, status: 'approved', category: 'Supplies', date: '2024-01-15', description: 'Order 1', receiptUrl: null, businessId: 'business-1', createdAt: new Date() },
      ]);
      mockPurchaseOrderRepository.find.mockResolvedValue([
        { id: 'po-1', supplierId: 'supplier-1', date: '2024-01-10', totalAmount: 500, status: 'received', supplierName: 'Test Supplier', businessId: 'business-1' },
      ]);
      mockPaymentRepository.find.mockResolvedValue([
        { id: 'pay-1', referenceId: 'exp-1', referenceType: 'expense', amount: 500, method: 'bank', reference: 'REF-001', date: '2024-01-20', createdAt: new Date() },
      ]);

      const result = await service.getProfile('supplier-1', 'business-1');

      expect(result.supplier.name).toBe('Test Supplier');
      expect(result.stats.totalPurchased).toBe(500);
      expect(result.stats.totalPaid).toBe(500);
      expect(result.stats.outstandingBalance).toBe(0);
      expect(result.expenses).toHaveLength(1);
      expect(result.purchaseOrders).toHaveLength(1);
      expect(result.payments).toHaveLength(1);
    });

    it('should handle supplier with no expenses', async () => {
      mockSupplierRepository.findOne.mockResolvedValue(mockSupplier);
      mockExpenseRepository.find.mockResolvedValue([]);
      mockPurchaseOrderRepository.find.mockResolvedValue([]);

      const result = await service.getProfile('supplier-1', 'business-1');

      expect(result.stats.totalPurchased).toBe(0);
      expect(result.stats.expenseCount).toBe(0);
      expect(result.payments).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a supplier', async () => {
      const updateDto: UpdateSupplierDto = { name: 'Updated Name', phone: '+9999999999' };

      mockSupplierRepository.findOne.mockResolvedValue({ ...mockSupplier });
      mockSupplierRepository.save.mockImplementation(s => Promise.resolve(s));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('supplier-1', 'business-1', updateDto, 'user-1', 'user@test.com');

      expect(result.name).toBe('Updated Name');
      expect(result.phone).toBe('+9999999999');
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1', 'user@test.com', 'updated_supplier', 'Supplier',
        'supplier-1', expect.objectContaining({ name: 'Updated Name' }), 'business-1'
      );
    });

    it('should update supplier even if audit fails', async () => {
      const updateDto: UpdateSupplierDto = { name: 'Updated' };
      mockSupplierRepository.findOne.mockResolvedValue({ ...mockSupplier });
      mockSupplierRepository.save.mockImplementation(s => Promise.resolve(s));
      mockAuditService.log.mockRejectedValue(new Error('Audit failed'));

      const result = await service.update('supplier-1', 'business-1', updateDto);

      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should remove a supplier', async () => {
      mockSupplierRepository.findOne.mockResolvedValue({ ...mockSupplier });
      mockSupplierRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('supplier-1', 'business-1', 'user-1', 'user@test.com');

      expect(supplierRepository.remove).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1', 'user@test.com', 'deleted_supplier', 'Supplier',
        'supplier-1', expect.objectContaining({ name: 'Test Supplier' }), 'business-1'
      );
    });

    it('should remove supplier even if audit fails', async () => {
      mockSupplierRepository.findOne.mockResolvedValue({ ...mockSupplier });
      mockSupplierRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockRejectedValue(new Error('Audit failed'));

      await expect(service.remove('supplier-1', 'business-1')).resolves.not.toThrow();
    });
  });

  describe('validateSupplier', () => {
    it('should return true for valid supplier', async () => {
      mockSupplierRepository.findOne.mockResolvedValue(mockSupplier);

      const result = await service.validateSupplier('supplier-1', 'business-1');

      expect(result).toBe(true);
    });

    it('should return false for invalid supplier', async () => {
      mockSupplierRepository.findOne.mockResolvedValue(null);

      const result = await service.validateSupplier('nonexistent', 'business-1');

      expect(result).toBe(false);
    });
  });
});
