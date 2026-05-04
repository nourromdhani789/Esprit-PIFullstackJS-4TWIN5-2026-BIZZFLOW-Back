import { Test, TestingModule } from '@nestjs/testing';
import { CashService } from './cash.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cash } from './entities/cash.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

describe('CashService', () => {
  let service: CashService;
  let cashRepository: Repository<Cash>;
  let paymentRepository: Repository<Payment>;

  const mockCashRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPaymentRepository = {
    find: jest.fn(),
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
        CashService,
        {
          provide: getRepositoryToken(Cash),
          useValue: mockCashRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
      ],
    }).compile();

    service = module.get<CashService>(CashService);
    cashRepository = module.get<Repository<Cash>>(getRepositoryToken(Cash));
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));

    jest.clearAllMocks();
  });

  describe('getOrCreateCash', () => {
    it('should return existing cash record', async () => {
      mockCashRepository.findOne.mockResolvedValue(mockCash);

      const result = await service.getOrCreateCash('business-1');

      expect(result).toEqual(mockCash);
      expect(cashRepository.findOne).toHaveBeenCalledWith({ where: { businessId: 'business-1' } });
    });

    it('should create cash record if not exists', async () => {
      mockCashRepository.findOne.mockResolvedValue(null);
      mockCashRepository.create.mockReturnValue({ businessId: 'business-1', currentBalance: 0 });
      mockCashRepository.save.mockResolvedValue(mockCash);

      const result = await service.getOrCreateCash('business-1');

      expect(cashRepository.create).toHaveBeenCalledWith({ businessId: 'business-1', currentBalance: 0 });
      expect(cashRepository.save).toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('should return calculated balance from payments', async () => {
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 500 });
      mockPaymentRepository.find.mockResolvedValue([
        { amount: 500, type: 'IN', businessId: 'business-1' },
        { amount: 200, type: 'OUT', businessId: 'business-1' },
      ]);
      mockCashRepository.save.mockResolvedValue({ ...mockCash, currentBalance: 300 });

      const result = await service.getBalance('business-1');

      expect(result).toBe(300);
    });

    it('should sync balance when different from calculated', async () => {
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 500 });
      mockPaymentRepository.find.mockResolvedValue([
        { amount: 1000, type: 'IN', businessId: 'business-1' },
      ]);
      mockCashRepository.save.mockImplementation(c => Promise.resolve(c));

      const result = await service.getBalance('business-1');

      expect(result).toBe(1000);
      expect(cashRepository.save).toHaveBeenCalled();
    });

    it('should not sync when balance matches', async () => {
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 1000 });
      mockPaymentRepository.find.mockResolvedValue([
        { amount: 1000, type: 'IN', businessId: 'business-1' },
      ]);

      const result = await service.getBalance('business-1');

      expect(result).toBe(1000);
      expect(cashRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateBalance', () => {
    it('should increase balance for IN type', async () => {
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 1000 });
      mockCashRepository.save.mockImplementation(c => Promise.resolve(c));

      const result = await service.updateBalance('business-1', 500, 'IN');

      expect(result.currentBalance).toBe(1500);
    });

    it('should decrease balance for OUT type', async () => {
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 1000 });
      mockCashRepository.save.mockImplementation(c => Promise.resolve(c));

      const result = await service.updateBalance('business-1', 300, 'OUT');

      expect(result.currentBalance).toBe(700);
    });

    it('should throw when insufficient balance for OUT', async () => {
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 100 });

      await expect(service.updateBalance('business-1', 200, 'OUT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCashDetails', () => {
    it('should return cash details with synced balance', async () => {
      mockCashRepository.findOne.mockResolvedValue({ ...mockCash, currentBalance: 500 });
      mockPaymentRepository.find.mockResolvedValue([
        { amount: 1000, type: 'IN', businessId: 'business-1' },
      ]);
      mockCashRepository.save.mockImplementation(c => Promise.resolve(c));

      const result = await service.getCashDetails('business-1');

      expect(result.currentBalance).toBe(1000);
    });
  });
});
