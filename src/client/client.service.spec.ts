import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from './client.service';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity';
import { CreditNote } from '../credit-note/entities/credit-note.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AuditService } from '../audit/audit.service';

describe('ClientService', () => {
  let service: ClientService;
  let clientRepository: jest.Mocked<Repository<Client>>;
  let invoiceRepository: jest.Mocked<Repository<Invoice>>;
  let creditNoteRepository: jest.Mocked<Repository<CreditNote>>;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let auditService: jest.Mocked<AuditService>;

  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        {
          provide: getRepositoryToken(Client),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(CreditNote),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockRepository(),
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    clientRepository = module.get(getRepositoryToken(Client));
    invoiceRepository = module.get(getRepositoryToken(Invoice));
    creditNoteRepository = module.get(getRepositoryToken(CreditNote));
    paymentRepository = module.get(getRepositoryToken(Payment));
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createClientDto = {
      name: 'Test Client',
      email: 'client@test.com',
      phone: '+1234567890',
      address: '123 Test Street',
    };

    it('should create a new client with audit log', async () => {
      const businessId = 'business-1';
      const savedClient = {
        id: 'client-1',
        ...createClientDto,
        businessId,
      } as Client;

      clientRepository.create.mockReturnValue(savedClient);
      clientRepository.save.mockResolvedValue(savedClient);

      const result = await service.create(businessId, createClientDto as any, 'user-1', 'user@test.com');

      expect(result).toEqual(savedClient);
      expect(clientRepository.create).toHaveBeenCalledWith({
        ...createClientDto,
        businessId,
      });
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1',
        'user@test.com',
        'created_client',
        'Client',
        'client-1',
        expect.any(Object),
        businessId,
      );
    });

    it('should create client even if audit logging fails', async () => {
      const businessId = 'business-1';
      const savedClient = {
        id: 'client-1',
        ...createClientDto,
        businessId,
      } as Client;

      clientRepository.create.mockReturnValue(savedClient);
      clientRepository.save.mockResolvedValue(savedClient);
      auditService.log.mockRejectedValue(new Error('Audit failed'));

      const result = await service.create(businessId, createClientDto as any);

      expect(result).toEqual(savedClient);
    });
  });

  describe('findAll', () => {
    it('should return clients with financial calculations', async () => {
      const businessId = 'business-1';
      const clients = [
        { id: 'client-1', name: 'Client 1', businessId } as Client,
        { id: 'client-2', name: 'Client 2', businessId } as Client,
      ];

      const invoices = [
        { id: 'inv-1', clientId: 'client-1', businessId, totalAmount: 1000, status: InvoiceStatus.PAID } as unknown as Invoice,
        { id: 'inv-2', clientId: 'client-1', businessId, totalAmount: 500, status: InvoiceStatus.UNPAID } as unknown as Invoice,
        { id: 'inv-3', clientId: 'client-2', businessId, totalAmount: 2000, status: InvoiceStatus.PAID } as unknown as Invoice,
      ];

      clientRepository.find.mockResolvedValue(clients);
      invoiceRepository.find.mockResolvedValue(invoices);

      const result = await service.findAll(businessId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('totalInvoiced');
      expect(result[0]).toHaveProperty('totalPaid');
      expect(result[0]).toHaveProperty('outstandingBalance');
      expect(result[0]).toHaveProperty('invoiceCount');
      
      // Client 1: 1500 total, 1000 paid, 500 outstanding, 2 invoices
      expect(result[0].totalInvoiced).toBe(1500);
      expect(result[0].totalPaid).toBe(1000);
      expect(result[0].outstandingBalance).toBe(500);
      expect(result[0].invoiceCount).toBe(2);
    });

    it('should return empty array if no clients', async () => {
      clientRepository.find.mockResolvedValue([]);

      const result = await service.findAll('business-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return client by id', async () => {
      const client = {
        id: 'client-1',
        name: 'Test Client',
        businessId: 'business-1',
      } as Client;

      clientRepository.findOne.mockResolvedValue(client);

      const result = await service.findOne('client-1', 'business-1');

      expect(result).toEqual(client);
      expect(clientRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'client-1', businessId: 'business-1' },
      });
    });

    it('should throw NotFoundException if client not found', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('client-1', 'business-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return comprehensive client profile', async () => {
      const client = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@test.com',
        phone: '+1234567890',
        address: '123 Test St',
        createdAt: new Date(),
      } as Client;

      const invoices = [
        {
          id: 'inv-1',
          clientId: 'client-1',
          businessId: 'business-1',
          totalAmount: 1000,
          status: InvoiceStatus.PAID,
          items: [{}, {}],
        } as unknown as Invoice,
        {
          id: 'inv-2',
          clientId: 'client-1',
          businessId: 'business-1',
          totalAmount: 500,
          status: InvoiceStatus.UNPAID,
          dueDate: new Date(Date.now() - 1000), // Overdue
          items: [{}],
        } as unknown as Invoice,
      ];

      const creditNotes = [
        { id: 'cn-1', clientName: 'Test Client', amount: 100, date: new Date() } as CreditNote,
      ];

      const payments = [
        { id: 'pay-1', referenceId: 'inv-1', referenceType: 'invoice', amount: 1000 } as Payment,
      ];

      clientRepository.findOne.mockResolvedValue(client);
      invoiceRepository.find.mockResolvedValue(invoices);
      creditNoteRepository.find.mockResolvedValue(creditNotes);
      paymentRepository.find.mockResolvedValue(payments);

      const result = await service.getProfile('client-1', 'business-1');

      expect(result.client).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.invoices).toHaveLength(2);
      expect(result.creditNotes).toHaveLength(1);
      expect(result.payments).toHaveLength(1);
      
      // Check stats calculations
      expect(result.stats.totalInvoiced).toBe(1500);
      expect(result.stats.totalPaid).toBe(1000);
      expect(result.stats.outstandingBalance).toBe(500);
      expect(result.stats.invoiceCount).toBe(2);
      expect(result.stats.creditNoteCount).toBe(1);
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Client Name',
      email: 'updated@test.com',
    };

    it('should update client successfully', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Old Name',
        email: 'old@test.com',
        businessId: 'business-1',
      } as Client;

      const updatedClient = {
        ...existingClient,
        ...updateDto,
      } as Client;

      clientRepository.findOne.mockResolvedValue(existingClient);
      clientRepository.save.mockResolvedValue(updatedClient);

      const result = await service.update('client-1', 'business-1', updateDto as any, 'user-1', 'user@test.com');

      expect(result.name).toBe('Updated Client Name');
      expect(result.email).toBe('updated@test.com');
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent client', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.update('client-1', 'business-1', updateDto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update client even if audit logging fails', async () => {
      const existingClient = {
        id: 'client-1',
        name: 'Old Name',
        businessId: 'business-1',
      } as Client;

      clientRepository.findOne.mockResolvedValue(existingClient);
      clientRepository.save.mockResolvedValue({ ...existingClient, ...updateDto } as Client);
      auditService.log.mockRejectedValue(new Error('Audit failed'));

      const result = await service.update('client-1', 'business-1', updateDto as any);

      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should delete client with audit log', async () => {
      const client = {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@test.com',
        businessId: 'business-1',
      } as Client;

      clientRepository.findOne.mockResolvedValue(client);
      clientRepository.remove.mockResolvedValue(client);

      await service.remove('client-1', 'business-1', 'user-1', 'user@test.com');

      expect(clientRepository.remove).toHaveBeenCalledWith(client);
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1',
        'user@test.com',
        'deleted_client',
        'Client',
        'client-1',
        expect.any(Object),
        'business-1',
      );
    });

    it('should throw NotFoundException when deleting non-existent client', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('client-1', 'business-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete client even if audit logging fails', async () => {
      const client = {
        id: 'client-1',
        name: 'Test Client',
        businessId: 'business-1',
      } as Client;

      clientRepository.findOne.mockResolvedValue(client);
      clientRepository.remove.mockResolvedValue(client);
      auditService.log.mockRejectedValue(new Error('Audit failed'));

      await service.remove('client-1', 'business-1');

      expect(clientRepository.remove).toHaveBeenCalled();
    });
  });

  describe('validateClient', () => {
    it('should return true if client exists for business', async () => {
      clientRepository.findOne.mockResolvedValue({ id: 'client-1' } as Client);

      const result = await service.validateClient('client-1', 'business-1');

      expect(result).toBe(true);
    });

    it('should return false if client does not exist', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      const result = await service.validateClient('client-1', 'business-1');

      expect(result).toBe(false);
    });
  });
});
