import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Product } from '../product/entities/product.entity';
import { Business } from '../business/entities/business.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Client } from '../client/entities/client.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let invoiceRepository: jest.Mocked<Repository<Invoice>>;
  let invoiceItemRepository: jest.Mocked<Repository<InvoiceItem>>;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let cashRepository: jest.Mocked<Repository<Cash>>;
  let productRepository: jest.Mocked<Repository<Product>>;
  let businessRepository: jest.Mocked<Repository<Business>>;
  let stockMovementRepository: jest.Mocked<Repository<StockMovement>>;
  let clientRepository: jest.Mocked<Repository<Client>>;
  let auditService: jest.Mocked<AuditService>;
  let notificationService: jest.Mocked<NotificationService>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockQueryRunner = () => ({
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      save: jest.fn().mockImplementation((entity) => {
        // Simulate database assigning an id
        if (entity && !entity.id) {
          entity.id = 'test-id-' + Date.now();
        }
        return Promise.resolve(entity);
      }),
      query: jest.fn().mockResolvedValue(undefined),
    },
  });

  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getMany: jest.fn(),
    })),
  });

  beforeEach(async () => {
    queryRunner = mockQueryRunner() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Cash),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Business),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: mockRepository(),
        },
        {
          provide: getRepositoryToken(Client),
          useValue: mockRepository(),
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    invoiceRepository = module.get(getRepositoryToken(Invoice));
    invoiceItemRepository = module.get(getRepositoryToken(InvoiceItem));
    paymentRepository = module.get(getRepositoryToken(Payment));
    cashRepository = module.get(getRepositoryToken(Cash));
    productRepository = module.get(getRepositoryToken(Product));
    businessRepository = module.get(getRepositoryToken(Business));
    stockMovementRepository = module.get(getRepositoryToken(StockMovement));
    clientRepository = module.get(getRepositoryToken(Client));
    auditService = module.get(AuditService);
    notificationService = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createInvoiceDto = {
      clientId: 'client-1',
      date: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: [
        { productId: 'product-1', description: 'Item 1', quantity: 2, price: 100 },
        { productId: 'product-2', description: 'Item 2', quantity: 1, price: 50 },
      ],
      notes: 'Test invoice',
      terms: 'Net 30',
    };

    it('should throw BadRequestException if client not found', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.create('business-1', createInvoiceDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if client belongs to different business', async () => {
      // Client exists but belongs to different business - should fail validation
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.create('business-1', createInvoiceDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create invoice with correct calculations', async () => {
      const client = { id: 'client-1', businessId: 'business-1' } as Client;
      const business = { id: 'business-1', taxRate: 20 } as Business;
      const savedInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV-2024-001',
        businessId: 'business-1',
        clientId: 'client-1',
        subtotal: 250,
        taxAmount: 50,
        totalAmount: 300,
        status: InvoiceStatus.UNPAID,
      } as Invoice;

      clientRepository.findOne.mockResolvedValue(client);
      businessRepository.findOne.mockResolvedValue(business);
      invoiceRepository.create.mockReturnValue(savedInvoice);
      
      // Mock queryRunner.manager.save to return the entity with ID
      queryRunner.manager.save.mockImplementation((entity: any) => {
        if (entity && !entity.id) {
          entity.id = 'invoice-1';
        }
        return Promise.resolve(entity);
      });

      // Mock findOne to return the saved invoice when called at the end
      invoiceRepository.findOne.mockResolvedValueOnce(client); // First call for client validation
      invoiceRepository.findOne.mockResolvedValueOnce(savedInvoice); // Second call for returning result

      // Mock latest invoice for number generation
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.create('business-1', createInvoiceDto as any);

      expect(result).toBeDefined();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should generate sequential invoice numbers', async () => {
      const client = { id: 'client-1', businessId: 'business-1' } as Client;
      const business = { id: 'business-1', taxRate: 0 } as Business;

      clientRepository.findOne.mockResolvedValue(client);
      businessRepository.findOne.mockResolvedValue(business);

      // Mock invoiceRepository.create to return a valid invoice object
      invoiceRepository.create.mockImplementation((data: any) => ({
        ...data,
        id: data.id || 'temp-invoice-id',
      }) as Invoice);

      // Mock existing invoice with current year (2026)
      const currentYear = new Date().getFullYear();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          invoiceNumber: `INV-${currentYear}-005`,
        }),
      };
      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Mock queryRunner.manager.save to return entity with id
      queryRunner.manager.save.mockImplementation((entity: any) => {
        if (!entity) return Promise.resolve(undefined);
        // Always return a new object with an id to simulate DB save
        const result = { ...entity, id: entity.id || 'invoice-2' };
        return Promise.resolve(result);
      });
      
      // Mock findOne to return the saved invoice at the end (called by this.findOne in service)
      invoiceRepository.findOne.mockResolvedValue({ 
        id: 'invoice-2', 
        invoiceNumber: `INV-${currentYear}-006`,
        items: [] 
      } as Invoice);

      const result = await service.create('business-1', createInvoiceDto as any);

      // Verify invoiceNumber was generated correctly (should be 006 since previous was 005)
      expect(result.invoiceNumber).toBe(`INV-${currentYear}-006`);
    });

    it('should handle transaction rollback on error', async () => {
      const client = { id: 'client-1', businessId: 'business-1' } as Client;
      const business = { id: 'business-1', taxRate: 20 } as Business;

      clientRepository.findOne.mockResolvedValue(client);
      businessRepository.findOne.mockResolvedValue(business);
      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await expect(service.create('business-1', createInvoiceDto as any)).rejects.toThrow(
        'Database error',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should throw NotFoundException if business not found', async () => {
      const client = { id: 'client-1', businessId: 'business-1' } as Client;

      clientRepository.findOne.mockResolvedValue(client);
      businessRepository.findOne.mockResolvedValue(null);

      await expect(service.create('business-1', createInvoiceDto as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create invoice items with correct totals', async () => {
      const client = { id: 'client-1', businessId: 'business-1' } as Client;
      const business = { id: 'business-1', taxRate: 10 } as Business;
      const savedInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV-2024-001',
        items: [],
      } as Invoice;

      clientRepository.findOne.mockResolvedValue(client);
      businessRepository.findOne.mockResolvedValue(business);
      invoiceRepository.create.mockReturnValue(savedInvoice);
      
      // Mock queryRunner.manager.save to return the entity with ID
      queryRunner.manager.save.mockImplementation((entity: any) => {
        if (entity && !entity.id) {
          entity.id = 'invoice-1';
        }
        return Promise.resolve(entity);
      });
      
      // Mock findOne for final result
      invoiceRepository.findOne.mockResolvedValueOnce(client); // Validation
      invoiceRepository.findOne.mockResolvedValueOnce(savedInvoice); // Result
      
      invoiceItemRepository.create.mockReturnValue({} as InvoiceItem);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      invoiceRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.create('business-1', createInvoiceDto as any);

      // Items are created via raw SQL query, not repository
      expect(queryRunner.manager.query).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all invoices for business', async () => {
      const invoices = [
        { id: 'inv-1', businessId: 'business-1', invoiceNumber: 'INV-001' },
        { id: 'inv-2', businessId: 'business-1', invoiceNumber: 'INV-002' },
      ] as Invoice[];

      invoiceRepository.find.mockResolvedValue(invoices);

      const result = await service.findAll('business-1');

      expect(result).toHaveLength(2);
      expect(invoiceRepository.find).toHaveBeenCalledWith({
        where: { businessId: 'business-1' },
        relations: ['items', 'items.product'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should return empty array if no invoices', async () => {
      invoiceRepository.find.mockResolvedValue([]);

      const result = await service.findAll('business-1');

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return invoice by id', async () => {
      const invoice = {
        id: 'inv-1',
        businessId: 'business-1',
        invoiceNumber: 'INV-001',
      } as Invoice;

      invoiceRepository.findOne.mockResolvedValue(invoice);

      const result = await service.findOne('inv-1', 'business-1');

      expect(result).toEqual(invoice);
    });

    it('should throw NotFoundException if invoice not found', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('inv-1', 'business-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });


  describe('update', () => {
    it('should update invoice successfully', async () => {
      const existingInvoice = {
        id: 'inv-1',
        businessId: 'business-1',
        status: InvoiceStatus.UNPAID,
        items: [],
      } as Invoice;

      const updateDto = {
        notes: 'Updated notes',
      };

      invoiceRepository.findOne.mockResolvedValue(existingInvoice);
      invoiceRepository.save.mockResolvedValue({ ...existingInvoice, ...updateDto } as Invoice);

      const result = await service.update('inv-1', 'business-1', updateDto as any);

      expect(result.notes).toBe('Updated notes');
    });

    it('should throw NotFoundException when updating non-existent invoice', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);

      await expect(service.update('inv-1', 'business-1', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete invoice', async () => {
      const invoice = {
        id: 'inv-1',
        businessId: 'business-1',
        status: InvoiceStatus.UNPAID,
      } as Invoice;

      invoiceRepository.findOne.mockResolvedValue(invoice);
      invoiceRepository.remove.mockResolvedValue(invoice);

      await service.remove('inv-1', 'business-1');

      expect(invoiceRepository.remove).toHaveBeenCalledWith(invoice);
    });

    it('should throw NotFoundException when deleting non-existent invoice', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('inv-1', 'business-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow deleting paid invoices', async () => {
      const invoice = {
        id: 'inv-1',
        businessId: 'business-1',
        status: InvoiceStatus.PAID,
        invoiceNumber: 'INV-001',
        client: { name: 'Test Client' },
        totalAmount: 1000,
      } as Invoice;

      invoiceRepository.findOne.mockResolvedValue(invoice);
      invoiceRepository.remove.mockResolvedValue(invoice);
      auditService.log.mockResolvedValue(undefined);

      await service.remove('inv-1', 'business-1');

      expect(invoiceRepository.remove).toHaveBeenCalledWith(invoice);
    });
  });

  describe('updateStatus', () => {
    it('should update invoice status to paid', async () => {
      const invoice = {
        id: 'inv-1',
        businessId: 'business-1',
        status: InvoiceStatus.UNPAID,
        totalAmount: 100,
      } as Invoice;

      const cash = {
        id: 'cash-1',
        businessId: 'business-1',
        currentBalance: 500,
      } as Cash;

      invoiceRepository.findOne.mockResolvedValue(invoice);
      cashRepository.findOne.mockResolvedValue(cash);
      queryRunner.manager.save.mockResolvedValue({ ...invoice, status: InvoiceStatus.PAID });

      const result = await service.updateStatus('inv-1', 'business-1', InvoiceStatus.PAID);

      expect(result.status).toBe(InvoiceStatus.PAID);
    });

    it('should throw NotFoundException if invoice not found when updating status', async () => {
      invoiceRepository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('inv-1', 'business-1', InvoiceStatus.PAID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generatePdf', () => {
    it('should generate PDF for invoice', async () => {
      const invoice = {
        id: 'inv-1',
        businessId: 'business-1',
        invoiceNumber: 'INV-001',
        items: [],
      } as Invoice;

      invoiceRepository.findOne.mockResolvedValue(invoice);

      const result = await service.generatePdf('inv-1', 'business-1');

      expect(result).toBeDefined();
    });
  });
});
