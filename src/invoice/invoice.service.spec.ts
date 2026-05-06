import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Product } from '../product/entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Client } from '../client/entities/client.entity';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let invoiceRepository: Repository<Invoice>;
  let auditService: AuditService;

  const queryRunner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(), release: jest.fn(),
    manager: { save: jest.fn(), query: jest.fn() },
  };

  const queryBuilder = {
    where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(), getOne: jest.fn(),
  };

  const mockInvoiceRepository = {
    create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(),
    remove: jest.fn(), createQueryBuilder: jest.fn(() => queryBuilder),
  };
  const mockInvoiceItemRepository = {};
  const mockPaymentRepository = { create: jest.fn(), find: jest.fn() };
  const mockCashRepository = { findOne: jest.fn(), create: jest.fn() };
  const mockProductRepository = { findOne: jest.fn() };
  const mockBusinessRepository = { findOne: jest.fn() };
  const mockStockMovementRepository = { create: jest.fn() };
  const mockClientRepository = { findOne: jest.fn() };
  const mockDataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const mockAuditService = { log: jest.fn() };
  const mockNotificationService = { create: jest.fn() };

  const mockInvoice = {
    id: 'invoice-1', invoiceNumber: 'INV-2024-001', clientId: 'client-1',
    businessId: 'business-1', status: 'draft', subtotal: 1000, taxAmount: 190,
    totalAmount: 1190, items: [], createdAt: new Date(), updatedAt: new Date(),
  };
  const mockClient = { id: 'client-1', name: 'Test Client', businessId: 'business-1' };
  const mockBusiness = { id: 'business-1', name: 'Test Business', taxRate: 19 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepository },
        { provide: getRepositoryToken(InvoiceItem), useValue: mockInvoiceItemRepository },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        { provide: getRepositoryToken(Cash), useValue: mockCashRepository },
        { provide: getRepositoryToken(Product), useValue: mockProductRepository },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepository },
        { provide: getRepositoryToken(StockMovement), useValue: mockStockMovementRepository },
        { provide: getRepositoryToken(Client), useValue: mockClientRepository },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    invoiceRepository = module.get<Repository<Invoice>>(getRepositoryToken(Invoice));
    auditService = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
    queryRunner.manager.save.mockReset();
    queryRunner.manager.query.mockReset();
    queryBuilder.getOne.mockReset();
  });

  describe('create', () => {
    it('should throw when client not found', async () => {
      mockClientRepository.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', { clientId: 'bad', items: [] } as any)).rejects.toThrow(BadRequestException);
    });

    it('should create an invoice with items', async () => {
      const createDto = { clientId: 'client-1', items: [{ quantity: 2, price: 500, description: 'Service', productId: null }] };
      mockClientRepository.findOne.mockResolvedValue(mockClient);
      queryBuilder.getOne.mockResolvedValue(null);
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      queryRunner.manager.save.mockResolvedValue(mockInvoice);
      queryRunner.manager.query.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockResolvedValue(undefined);
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);

      const result = await service.create('business-1', createDto as any);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when business not found', async () => {
      mockClientRepository.findOne.mockResolvedValue(mockClient);
      queryBuilder.getOne.mockResolvedValue(null);
      mockBusinessRepository.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', { clientId: 'client-1', items: [] } as any)).rejects.toThrow(NotFoundException);
    });

    it('should handle notification failure gracefully', async () => {
      const createDto = { clientId: 'client-1', items: [{ quantity: 1, price: 100, description: 'Item', productId: null }] };
      mockClientRepository.findOne.mockResolvedValue(mockClient);
      queryBuilder.getOne.mockResolvedValue(null);
      mockBusinessRepository.findOne.mockResolvedValue(mockBusiness);
      queryRunner.manager.save.mockResolvedValue(mockInvoice);
      queryRunner.manager.query.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockRejectedValue(new Error('Notification failed'));
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);

      const result = await service.create('business-1', createDto as any);
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all invoices for business', async () => {
      mockInvoiceRepository.find.mockResolvedValue([mockInvoice]);
      const result = await service.findAll('business-1');
      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('findOne', () => {
    it('should return an invoice by id', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);
      const result = await service.findOne('invoice-1', 'business-1');
      expect(result).toEqual(mockInvoice);
    });

    it('should throw NotFoundException when not found', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an invoice', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue({ ...mockInvoice });
      mockInvoiceRepository.save.mockImplementation(i => Promise.resolve(i));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('invoice-1', 'business-1', { status: 'sent' } as any, 'user-1', 'user@test.com');
      expect(result.status).toBe('sent');
    });

    it('should validate client when updating clientId', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue({ ...mockInvoice });
      mockClientRepository.findOne.mockResolvedValue(null);
      await expect(service.update('invoice-1', 'business-1', { clientId: 'bad' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should update status to paid and create payment', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);
      queryRunner.manager.save.mockResolvedValue({ ...mockInvoice, status: 'paid' });
      mockPaymentRepository.create.mockReturnValue({ type: 'IN', amount: 1190 });
      mockCashRepository.findOne.mockResolvedValue({ id: 'cash-1', businessId: 'business-1', currentBalance: 0 });
      mockAuditService.log.mockResolvedValue(undefined);

      await service.updateStatus('invoice-1', 'business-1', 'paid' as any, 'user-1', 'user@test.com');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should not create payment when status is not paid', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);
      queryRunner.manager.save.mockResolvedValue({ ...mockInvoice, status: 'sent' });
      mockAuditService.log.mockResolvedValue(undefined);

      await service.updateStatus('invoice-1', 'business-1', 'sent' as any);
      expect(mockPaymentRepository.create).not.toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);
      queryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      await expect(service.updateStatus('invoice-1', 'business-1', 'paid' as any)).rejects.toThrow('DB error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove an invoice', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue({ ...mockInvoice });
      mockInvoiceRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('invoice-1', 'business-1', 'user-1', 'user@test.com');
      expect(invoiceRepository.remove).toHaveBeenCalled();
    });
  });

  describe('generatePdf', () => {
    it('should return a buffer', async () => {
      mockInvoiceRepository.findOne.mockResolvedValue(mockInvoice);
      const result = await service.generatePdf('invoice-1', 'business-1');
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
