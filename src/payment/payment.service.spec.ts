import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { CreatePaymentDto, UpdatePaymentDto, PaymentFilterDto } from './dto/payment.dto';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: Repository<Payment>;
  let cashRepository: Repository<Cash>;
  let auditService: AuditService;
  let notificationService: NotificationService;

  const queryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const mockCashRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockNotificationService = {
    create: jest.fn(),
  };

  const mockPayment = {
    id: 'payment-1',
    type: 'IN' as const,
    amount: 500,
    method: 'cash' as const,
    description: 'Invoice payment',
    referenceId: 'invoice-1',
    referenceType: 'invoice',
    businessId: 'business-1',
    date: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCash = {
    id: 'cash-1',
    businessId: 'business-1',
    currentBalance: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(Cash),
          useValue: mockCashRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    cashRepository = module.get<Repository<Cash>>(getRepositoryToken(Cash));
    auditService = module.get<AuditService>(AuditService);
    notificationService = module.get<NotificationService>(NotificationService);

    jest.clearAllMocks();
    queryRunner.manager.save.mockReset();
    queryBuilder.getMany.mockReset();
  });

  describe('create', () => {
    it('should create an IN payment and update cash balance', async () => {
      const createDto: CreatePaymentDto = {
        type: 'IN',
        amount: 500,
        method: 'cash',
        description: 'Invoice payment',
      };

      queryRunner.manager.save.mockResolvedValue(mockPayment);
      mockCashRepository.findOne.mockResolvedValue(mockCash);
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockResolvedValue(undefined);

      const result = await service.create('business-1', createDto, 'user-1', 'user@test.com');

      expect(result).toEqual(mockPayment);
      expect(queryRunner.manager.save).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1', 'user@test.com', 'recorded_payment_in', 'Payment',
        'payment-1', expect.objectContaining({ amount: 500, type: 'IN' }), 'business-1'
      );
    });

    it('should create cash record if not exists', async () => {
      const createDto: CreatePaymentDto = {
        type: 'IN',
        amount: 100,
        method: 'bank',
      };

      queryRunner.manager.save.mockResolvedValue({ ...mockPayment, amount: 100 });
      mockCashRepository.findOne.mockResolvedValue(null);
      mockCashRepository.create.mockReturnValue({ businessId: 'business-1', currentBalance: 0 });
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockResolvedValue(undefined);

      await service.create('business-1', createDto);

      expect(mockCashRepository.create).toHaveBeenCalledWith({
        businessId: 'business-1',
        currentBalance: 0,
      });
    });

    it('should throw when OUT payment with insufficient balance', async () => {
      const createDto: CreatePaymentDto = {
        type: 'OUT',
        amount: 2000,
        method: 'cash',
      };

      queryRunner.manager.save.mockResolvedValue({ ...mockPayment, type: 'OUT', amount: 2000 });
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 500 });
      mockAuditService.log.mockResolvedValue(undefined);

      await expect(service.create('business-1', createDto)).rejects.toThrow(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should create OUT payment with sufficient balance', async () => {
      const createDto: CreatePaymentDto = {
        type: 'OUT',
        amount: 200,
        method: 'cash',
      };

      const outPayment = { ...mockPayment, type: 'OUT', amount: 200 };
      queryRunner.manager.save.mockResolvedValue(outPayment);
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 1000 });
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockResolvedValue(undefined);

      const result = await service.create('business-1', createDto, 'user-1', 'user@test.com');

      expect(result.type).toBe('OUT');
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1', 'user@test.com', 'recorded_payment_out', 'Payment',
        'payment-1', expect.objectContaining({ type: 'OUT' }), 'business-1'
      );
    });

    it('should handle notification failure gracefully', async () => {
      const createDto: CreatePaymentDto = {
        type: 'IN',
        amount: 100,
        method: 'cash',
      };

      queryRunner.manager.save.mockResolvedValue(mockPayment);
      mockCashRepository.findOne.mockResolvedValue(mockCash);
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockRejectedValue(new Error('Notification failed'));

      const result = await service.create('business-1', createDto);

      expect(result).toEqual(mockPayment);
    });
  });

  describe('findAll', () => {
    it('should return all payments for business', async () => {
      const payments = [mockPayment];
      queryBuilder.getMany.mockResolvedValue(payments);

      const result = await service.findAll('business-1');

      expect(result).toEqual(payments);
    });

    it('should apply filters', async () => {
      const filters: PaymentFilterDto = { type: 'IN', method: 'cash' };
      const payments = [mockPayment];
      queryBuilder.getMany.mockResolvedValue(payments);

      const result = await service.findAll('business-1', filters);

      expect(result).toEqual(payments);
      expect(queryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a payment by id', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne('payment-1', 'business-1');

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException when payment not found', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a payment', async () => {
      const updateDto: UpdatePaymentDto = { description: 'Updated' };
      mockPaymentRepository.findOne.mockResolvedValue({ ...mockPayment });
      mockPaymentRepository.save.mockImplementation(p => Promise.resolve(p));

      const result = await service.update('payment-1', 'business-1', updateDto);

      expect(result.description).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should remove a payment', async () => {
      mockPaymentRepository.findOne.mockResolvedValue({ ...mockPayment });
      mockPaymentRepository.remove.mockResolvedValue(undefined);

      await service.remove('payment-1', 'business-1');

      expect(paymentRepository.remove).toHaveBeenCalled();
    });
  });
});
