import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from './client.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity';
import { CreditNote } from '../credit-note/entities/credit-note.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

describe('ClientService', () => {
  let service: ClientService;
  let clientRepository: Repository<Client>;
  let invoiceRepository: Repository<Invoice>;
  let auditService: AuditService;

  const mockClientRepository = {
    create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), remove: jest.fn(),
  };
  const mockInvoiceRepository = { find: jest.fn() };
  const mockCreditNoteRepository = { find: jest.fn() };
  const mockPaymentRepository = { find: jest.fn() };
  const mockAuditService = { log: jest.fn() };

  const mockClient = {
    id: 'client-1', name: 'Test Client', email: 'client@test.com', phone: '+1234567890',
    address: '123 Test St', businessId: 'business-1', createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        { provide: getRepositoryToken(Client), useValue: mockClientRepository },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepository },
        { provide: getRepositoryToken(CreditNote), useValue: mockCreditNoteRepository },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    clientRepository = module.get<Repository<Client>>(getRepositoryToken(Client));
    invoiceRepository = module.get<Repository<Invoice>>(getRepositoryToken(Invoice));
    auditService = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a client', async () => {
      mockClientRepository.create.mockReturnValue(mockClient);
      mockClientRepository.save.mockResolvedValue(mockClient);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', { name: 'Test', email: 'test@test.com' }, 'user-1', 'user@test.com');
      expect(result).toEqual(mockClient);
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should create client even if audit fails', async () => {
      mockClientRepository.create.mockReturnValue(mockClient);
      mockClientRepository.save.mockResolvedValue(mockClient);
      mockAuditService.log.mockRejectedValue(new Error('Audit failed'));

      const result = await service.create('business-1', { name: 'Test' });
      expect(result).toEqual(mockClient);
    });
  });

  describe('findAll', () => {
    it('should return clients with computed fields', async () => {
      mockClientRepository.find.mockResolvedValue([mockClient]);
      mockInvoiceRepository.find.mockResolvedValue([
        { clientId: 'client-1', totalAmount: 1000, status: InvoiceStatus.PAID },
        { clientId: 'client-1', totalAmount: 500, status: InvoiceStatus.UNPAID },
      ]);

      const result = await service.findAll('business-1');
      expect(result).toHaveLength(1);
      expect(result[0].totalInvoiced).toBe(1500);
      expect(result[0].totalPaid).toBe(1000);
      expect(result[0].outstandingBalance).toBe(500);
      expect(result[0].invoiceCount).toBe(2);
    });

    it('should return empty array when no clients', async () => {
      mockClientRepository.find.mockResolvedValue([]);
      const result = await service.findAll('business-1');
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a client by id', async () => {
      mockClientRepository.findOne.mockResolvedValue(mockClient);
      const result = await service.findOne('client-1', 'business-1');
      expect(result).toEqual(mockClient);
    });

    it('should throw NotFoundException when not found', async () => {
      mockClientRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('should return comprehensive client profile', async () => {
      mockClientRepository.findOne.mockResolvedValue(mockClient);
      mockInvoiceRepository.find.mockResolvedValue([
        { id: 'inv-1', clientId: 'client-1', totalAmount: 1000, status: InvoiceStatus.PAID, items: [], dueDate: null, createdAt: new Date() },
      ]);
      mockCreditNoteRepository.find.mockResolvedValue([]);
      mockPaymentRepository.find.mockResolvedValue([
        { id: 'pay-1', referenceId: 'inv-1', referenceType: 'invoice', amount: 1000, method: 'transfer', reference: 'REF-001', date: new Date() },
      ]);

      const result = await service.getProfile('client-1', 'business-1');
      expect(result.client.name).toBe('Test Client');
      expect(result.stats.totalInvoiced).toBe(1000);
      expect(result.invoices).toHaveLength(1);
      expect(result.payments).toHaveLength(1);
    });

    it('should calculate overdue amount', async () => {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      mockClientRepository.findOne.mockResolvedValue(mockClient);
      mockInvoiceRepository.find.mockResolvedValue([
        { id: 'inv-1', clientId: 'client-1', totalAmount: 500, status: InvoiceStatus.UNPAID, dueDate: yesterday, items: [], createdAt: new Date() },
      ]);
      mockCreditNoteRepository.find.mockResolvedValue([]);
      mockPaymentRepository.find.mockResolvedValue([]);

      const result = await service.getProfile('client-1', 'business-1');
      expect(result.stats.overdueAmount).toBe(500);
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      mockClientRepository.findOne.mockResolvedValue({ ...mockClient });
      mockClientRepository.save.mockImplementation(c => Promise.resolve(c));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('client-1', 'business-1', { name: 'Updated' }, 'user-1', 'user@test.com');
      expect(result.name).toBe('Updated');
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should update client even if audit fails', async () => {
      mockClientRepository.findOne.mockResolvedValue({ ...mockClient });
      mockClientRepository.save.mockImplementation(c => Promise.resolve(c));
      mockAuditService.log.mockRejectedValue(new Error('Audit failed'));

      const result = await service.update('client-1', 'business-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should remove a client', async () => {
      mockClientRepository.findOne.mockResolvedValue({ ...mockClient });
      mockClientRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('client-1', 'business-1', 'user-1', 'user@test.com');
      expect(clientRepository.remove).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should remove client even if audit fails', async () => {
      mockClientRepository.findOne.mockResolvedValue({ ...mockClient });
      mockClientRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockRejectedValue(new Error('Audit failed'));

      await expect(service.remove('client-1', 'business-1')).resolves.not.toThrow();
    });
  });

  describe('validateClient', () => {
    it('should return true for valid client', async () => {
      mockClientRepository.findOne.mockResolvedValue(mockClient);
      const result = await service.validateClient('client-1', 'business-1');
      expect(result).toBe(true);
    });

    it('should return false for invalid client', async () => {
      mockClientRepository.findOne.mockResolvedValue(null);
      const result = await service.validateClient('nonexistent', 'business-1');
      expect(result).toBe(false);
    });
  });
});
