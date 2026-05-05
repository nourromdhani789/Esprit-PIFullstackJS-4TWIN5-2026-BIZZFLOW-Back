import { Test, TestingModule } from '@nestjs/testing';
import { CreditNoteService } from './credit-note.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreditNote } from './entities/credit-note.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

describe('CreditNoteService', () => {
  let service: CreditNoteService;
  let repo: Repository<CreditNote>;

  const queryRunner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(), release: jest.fn(), manager: { save: jest.fn() },
  };

  const mockRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), remove: jest.fn() };
  const mockInvoiceRepo = { findOne: jest.fn() };
  const mockPaymentRepo = { create: jest.fn() };
  const mockCashRepo = { findOne: jest.fn(), create: jest.fn() };
  const mockDataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const mockAuditService = { log: jest.fn() };
  const mockNotificationService = { create: jest.fn() };

  const mockCreditNote = {
    id: 'cn-1', creditNoteNumber: 'CN-2024-001', invoiceId: 'inv-1', clientName: 'Test Client',
    amount: 500, reason: 'Discount', status: 'draft', businessId: 'business-1',
    date: new Date(), createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditNoteService,
        { provide: getRepositoryToken(CreditNote), useValue: mockRepo },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Cash), useValue: mockCashRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<CreditNoteService>(CreditNoteService);
    repo = module.get<Repository<CreditNote>>(getRepositoryToken(CreditNote));
    jest.clearAllMocks();
    queryRunner.manager.save.mockReset();
  });

  describe('create', () => {
    it('should create credit note', async () => {
      mockRepo.create.mockReturnValue(mockCreditNote);
      queryRunner.manager.save.mockResolvedValue(mockCreditNote);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', { invoiceId: 'inv-1', amount: 500, reason: 'Discount', clientName: 'Test' }, 'user-1');
      expect(result).toEqual(mockCreditNote);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all credit notes', async () => {
      mockRepo.find.mockResolvedValue([mockCreditNote]);
      const result = await service.findAll('business-1');
      expect(result).toEqual([mockCreditNote]);
    });

    it('should filter by status', async () => {
      mockRepo.find.mockResolvedValue([mockCreditNote]);
      const result = await service.findAll('business-1', 'draft');
      expect(repo.find).toHaveBeenCalledWith({ where: { businessId: 'business-1', status: 'draft' }, relations: ['invoice'], order: { date: 'DESC' } });
    });
  });

  describe('findOne', () => {
    it('should return credit note', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote });
      const result = await service.findOne('cn-1', 'business-1');
      expect(result).toEqual(mockCreditNote);
    });

    it('should throw when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft credit note', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote });
      mockRepo.save.mockImplementation(cn => Promise.resolve({ ...cn, reason: 'Updated' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('cn-1', 'business-1', { reason: 'Updated' } as any, 'user-1');
      expect(result.reason).toBe('Updated');
    });

    it('should throw when updating non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'approved' });
      await expect(service.update('cn-1', 'business-1', { reason: 'Updated' } as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('approve', () => {
    it('should approve draft credit note', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote });
      mockRepo.save.mockImplementation(cn => Promise.resolve({ ...cn, status: 'approved' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.approve('cn-1', 'business-1', 'user-1');
      expect(result.status).toBe('approved');
    });

    it('should throw when approving non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'approved' });
      await expect(service.approve('cn-1', 'business-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('apply', () => {
    it('should apply approved credit note', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'approved' });
      queryRunner.manager.save.mockResolvedValue({ ...mockCreditNote, status: 'applied' });
      mockInvoiceRepo.findOne.mockResolvedValue({ id: 'inv-1', totalAmount: 1000 });
      mockCashRepo.findOne.mockResolvedValue({ id: 'cash-1', currentBalance: 500 });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.apply('cn-1', 'business-1', 'user-1');
      expect(result.status).toBe('applied');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when applying non-approved', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote });
      await expect(service.apply('cn-1', 'business-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('refund', () => {
    it('should refund approved credit note', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'approved' });
      queryRunner.manager.save.mockResolvedValue({ ...mockCreditNote, status: 'refunded' });
      mockCashRepo.findOne.mockResolvedValue({ id: 'cash-1', currentBalance: 1000 });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.refund('cn-1', 'business-1', 'user-1');
      expect(result.status).toBe('refunded');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when insufficient cash', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'approved', amount: 500 });
      mockCashRepo.findOne.mockResolvedValue({ id: 'cash-1', currentBalance: 100 });
      await expect(service.refund('cn-1', 'business-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it('should cancel credit note', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'approved' });
      queryRunner.manager.save.mockResolvedValue({ ...mockCreditNote, status: 'cancelled' });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.cancel('cn-1', 'business-1', 'user-1');
      expect(result.status).toBe('cancelled');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when already cancelled', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'cancelled' });
      await expect(service.cancel('cn-1', 'business-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should remove draft credit note', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote });
      mockRepo.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('cn-1', 'business-1', 'user-1');
      expect(repo.remove).toHaveBeenCalled();
    });

    it('should throw when removing non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockCreditNote, status: 'approved' });
      await expect(service.remove('cn-1', 'business-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSummary', () => {
    it('should return summary', async () => {
      mockRepo.find.mockResolvedValue([
        { ...mockCreditNote, status: 'approved', amount: 100 },
        { ...mockCreditNote, status: 'applied', amount: 200 },
        { ...mockCreditNote, status: 'refunded', amount: 300 },
      ]);

      const result = await service.getSummary('business-1');
      expect(result.totalActive).toBe(100);
      expect(result.totalApplied).toBe(200);
      expect(result.totalRefunded).toBe(300);
      expect(result.count).toBe(1);
    });
  });
});
