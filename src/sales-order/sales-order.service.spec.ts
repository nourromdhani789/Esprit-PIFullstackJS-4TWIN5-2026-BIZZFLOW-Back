import { Test, TestingModule } from '@nestjs/testing';
import { SalesOrderService } from './sales-order.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { Client } from '../client/entities/client.entity';
import { Business } from '../business/entities/business.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

describe('SalesOrderService', () => {
  let service: SalesOrderService;
  let repo: Repository<SalesOrder>;

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
  const mockProductRepo = { findOne: jest.fn() };
  const mockStockMovementRepo = { create: jest.fn() };
  const mockDataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const mockAuditService = { log: jest.fn() };
  const mockNotificationService = { create: jest.fn() };

  const mockOrder = {
    id: 'so-1', salesOrderNumber: 'SO-2024-001', clientId: 'client-1', businessId: 'business-1',
    status: SalesOrderStatus.DRAFT, subtotal: 1000, taxAmount: 190, totalAmount: 1190, items: [],
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderService,
        { provide: getRepositoryToken(SalesOrder), useValue: mockRepo },
        { provide: getRepositoryToken(SalesOrderItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: getRepositoryToken(StockMovement), useValue: mockStockMovementRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
    repo = module.get<Repository<SalesOrder>>(getRepositoryToken(SalesOrder));
    jest.clearAllMocks();
    queryRunner.manager.save.mockReset();
    queryRunner.manager.query.mockReset();
    queryBuilder.getOne.mockReset();
  });

  describe('create', () => {
    it('should create sales order', async () => {
      mockClientRepo.findOne.mockResolvedValue({ id: 'client-1', name: 'Test' });
      mockBusinessRepo.findOne.mockResolvedValue({ id: 'business-1', taxRate: 19 });
      queryRunner.manager.save.mockResolvedValue(mockOrder);
      queryRunner.manager.query.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
      mockRepo.findOne.mockResolvedValue({ ...mockOrder });

      const result = await service.create('business-1', { clientId: 'client-1', items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, description: 'Item' }] } as any);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when client not found', async () => {
      mockClientRepo.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', { clientId: 'bad', items: [] } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      mockRepo.find.mockResolvedValue([mockOrder]);
      const result = await service.findAll('business-1');
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findOne', () => {
    it('should return order', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder });
      const result = await service.findOne('so-1', 'business-1');
      expect(result).toEqual(mockOrder);
    });

    it('should throw when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft order', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder });
      mockRepo.save.mockImplementation(o => Promise.resolve({ ...o, notes: 'Updated' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('so-1', 'business-1', { notes: 'Updated' } as any, 'user-1');
      expect(result.notes).toBe('Updated');
    });

    it('should throw when updating non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CONFIRMED });
      await expect(service.update('so-1', 'business-1', { notes: 'Updated' } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm', () => {
    it('should confirm draft order', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, items: [{ productId: 'prod-1', quantity: 1 }] });
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', name: 'Test', quantity: 100, productType: 'storable' });
      queryRunner.manager.save.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CONFIRMED });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.confirm('so-1', 'business-1', 'user-1');
      expect(result.status).toBe(SalesOrderStatus.CONFIRMED);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when confirming non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CONFIRMED });
      await expect(service.confirm('so-1', 'business-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw when insufficient stock', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, items: [{ productId: 'prod-1', quantity: 50 }] });
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', name: 'Test', quantity: 10, productType: 'storable' });
      await expect(service.confirm('so-1', 'business-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deliver', () => {
    it('should deliver confirmed order', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CONFIRMED });
      mockRepo.save.mockImplementation(o => Promise.resolve({ ...o, status: SalesOrderStatus.DELIVERED }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.deliver('so-1', 'business-1', 'user-1');
      expect(result.status).toBe(SalesOrderStatus.DELIVERED);
    });

    it('should throw when delivering non-confirmed', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder });
      await expect(service.deliver('so-1', 'business-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel draft order', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder });
      queryRunner.manager.save.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CANCELLED });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.cancel('so-1', 'business-1', 'user-1');
      expect(result.status).toBe(SalesOrderStatus.CANCELLED);
    });

    it('should throw when already cancelled', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CANCELLED });
      await expect(service.cancel('so-1', 'business-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw when delivered', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.DELIVERED });
      await expect(service.cancel('so-1', 'business-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove draft order', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder });
      mockRepo.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('so-1', 'business-1', 'user-1');
      expect(repo.remove).toHaveBeenCalled();
    });

    it('should throw when removing non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CONFIRMED });
      await expect(service.remove('so-1', 'business-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('duplicate', () => {
    it('should duplicate order', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, items: [{ productId: 'prod-1', quantity: 1, unitPrice: 100, description: 'Item' }] });
      mockClientRepo.findOne.mockResolvedValue({ id: 'client-1' });
      mockBusinessRepo.findOne.mockResolvedValue({ id: 'business-1', taxRate: 19 });
      queryRunner.manager.save.mockResolvedValue({ ...mockOrder, id: 'so-2' });
      queryRunner.manager.query.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);
      mockRepo.findOne.mockResolvedValue({ ...mockOrder, id: 'so-2' });

      const result = await service.duplicate('so-1', 'business-1', 'user-1');
      expect(result.id).toBe('so-2');
    });
  });
});
