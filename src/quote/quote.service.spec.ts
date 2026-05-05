import { Test, TestingModule } from '@nestjs/testing';
import { QuoteService } from './quote.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Quote, QuoteStatus } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { Client } from '../client/entities/client.entity';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

describe('QuoteService', () => {
  let service: QuoteService;
  let repo: Repository<Quote>;

  const queryRunner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(), release: jest.fn(), manager: { save: jest.fn(), query: jest.fn() },
  };

  const queryBuilder = {
    where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(), getOne: jest.fn(),
  };

  const mockRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), remove: jest.fn(), createQueryBuilder: jest.fn(() => queryBuilder) };
  const mockItemRepo = {};
  const mockClientRepo = { findOne: jest.fn() };
  const mockBusinessRepo = { findOne: jest.fn() };
  const mockProductRepo = {};
  const mockDataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const mockAuditService = { log: jest.fn() };
  const mockNotificationService = { create: jest.fn() };

  const mockQuote = {
    id: 'quote-1', quoteNumber: 'QUO-2024-001', clientId: 'client-1', businessId: 'business-1',
    status: QuoteStatus.DRAFT, subtotal: 1000, taxAmount: 190, totalAmount: 1190, items: [],
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        { provide: getRepositoryToken(Quote), useValue: mockRepo },
        { provide: getRepositoryToken(QuoteItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<QuoteService>(QuoteService);
    repo = module.get<Repository<Quote>>(getRepositoryToken(Quote));
    jest.clearAllMocks();
    queryRunner.manager.save.mockReset();
    queryRunner.manager.query.mockReset();
    queryBuilder.getOne.mockReset();
  });

  describe('create', () => {
    it('should create quote', async () => {
      mockClientRepo.findOne.mockResolvedValue({ id: 'client-1', name: 'Test' });
      queryBuilder.getOne.mockResolvedValue(null);
      mockBusinessRepo.findOne.mockResolvedValue({ id: 'business-1', taxRate: 19 });
      queryRunner.manager.save.mockResolvedValue(mockQuote);
      queryRunner.manager.query.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });

      const result = await service.create('business-1', { clientId: 'client-1', items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, description: 'Item' }] } as any);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when client not found', async () => {
      mockClientRepo.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', { clientId: 'bad', items: [] } as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw when business not found', async () => {
      mockClientRepo.findOne.mockResolvedValue({ id: 'client-1' });
      queryBuilder.getOne.mockResolvedValue(null);
      mockBusinessRepo.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', { clientId: 'client-1', items: [] } as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all quotes', async () => {
      mockRepo.find.mockResolvedValue([mockQuote]);
      const result = await service.findAll('business-1');
      expect(result).toEqual([mockQuote]);
    });
  });

  describe('findOne', () => {
    it('should return quote', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });
      const result = await service.findOne('quote-1', 'business-1');
      expect(result).toEqual(mockQuote);
    });

    it('should throw when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft quote', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });
      mockRepo.save.mockImplementation(q => Promise.resolve({ ...q, notes: 'Updated' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('quote-1', 'business-1', { notes: 'Updated' } as any, 'user-1');
      expect(result.notes).toBe('Updated');
    });

    it('should throw when updating non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote, status: QuoteStatus.SENT });
      await expect(service.update('quote-1', 'business-1', { notes: 'Updated' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should update status', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });
      mockRepo.save.mockImplementation(q => Promise.resolve({ ...q, status: QuoteStatus.SENT }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.updateStatus('quote-1', 'business-1', QuoteStatus.SENT, 'user-1');
      expect(result.status).toBe(QuoteStatus.SENT);
    });
  });

  describe('remove', () => {
    it('should remove draft quote', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });
      mockRepo.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('quote-1', 'business-1', 'user-1');
      expect(repo.remove).toHaveBeenCalled();
    });

    it('should throw when removing non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote, status: QuoteStatus.SENT });
      await expect(service.remove('quote-1', 'business-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markAsSent', () => {
    it('should mark as sent', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });
      mockRepo.save.mockImplementation(q => Promise.resolve({ ...q, status: QuoteStatus.SENT }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.markAsSent('quote-1', 'business-1', 'user-1');
      expect(result.status).toBe(QuoteStatus.SENT);
    });
  });

  describe('markAsAccepted', () => {
    it('should mark as accepted', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });
      mockRepo.save.mockImplementation(q => Promise.resolve({ ...q, status: QuoteStatus.ACCEPTED }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.markAsAccepted('quote-1', 'business-1', 'user-1');
      expect(result.status).toBe(QuoteStatus.ACCEPTED);
    });
  });

  describe('markAsRejected', () => {
    it('should mark as rejected', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote });
      mockRepo.save.mockImplementation(q => Promise.resolve({ ...q, status: QuoteStatus.REJECTED }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.markAsRejected('quote-1', 'business-1', 'user-1');
      expect(result.status).toBe(QuoteStatus.REJECTED);
    });
  });

  describe('duplicate', () => {
    it('should duplicate quote', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockQuote, items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100 }] });
      mockClientRepo.findOne.mockResolvedValue({ id: 'client-1', name: 'Test' });
      queryBuilder.getOne.mockResolvedValue(null);
      mockBusinessRepo.findOne.mockResolvedValue({ id: 'business-1', taxRate: 19 });
      queryRunner.manager.save.mockResolvedValue({ ...mockQuote, id: 'quote-2' });
      queryRunner.manager.query.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
      mockRepo.findOne.mockResolvedValue({ ...mockQuote, id: 'quote-2' });

      const result = await service.duplicate('quote-1', 'business-1', 'user-1');
      expect(result.id).toBe('quote-2');
    });
  });
});
