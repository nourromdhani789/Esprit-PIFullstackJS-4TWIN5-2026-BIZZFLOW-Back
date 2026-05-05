import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrderService } from './purchase-order.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Product } from '../product/entities/product.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;
  let repository: Repository<PurchaseOrder>;

  const queryRunner = {
    connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(), release: jest.fn(), manager: { save: jest.fn() },
  };

  const mockRepository = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), remove: jest.fn() };
  const mockProductRepository = { findOne: jest.fn(), save: jest.fn() };
  const mockSupplierRepository = { findOne: jest.fn() };
  const mockStockMovementRepository = { create: jest.fn() };
  const mockDataSource = { createQueryRunner: jest.fn(() => queryRunner) };
  const mockAuditService = { log: jest.fn() };
  const mockNotificationService = { create: jest.fn() };

  const createMockOrder = () => ({
    id: 'po-1', supplierId: 'supplier-1', supplierName: 'Test Supplier',
    businessId: 'business-1', status: 'pending', totalAmount: 1000,
    date: new Date(), notes: 'Test notes', createdAt: new Date(), updatedAt: new Date(),
  });
  const mockSupplier = { id: 'supplier-1', name: 'Test Supplier', businessId: 'business-1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: getRepositoryToken(PurchaseOrder), useValue: mockRepository },
        { provide: getRepositoryToken(Product), useValue: mockProductRepository },
        { provide: getRepositoryToken(Supplier), useValue: mockSupplierRepository },
        { provide: getRepositoryToken(StockMovement), useValue: mockStockMovementRepository },
        { provide: DataSource, useValue: mockDataSource },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);
    repository = module.get<Repository<PurchaseOrder>>(getRepositoryToken(PurchaseOrder));
    jest.clearAllMocks();
    queryRunner.manager.save.mockReset();
  });

  describe('create', () => {
    it('should create purchase order', async () => {
      const mockOrder = createMockOrder();
      mockSupplierRepository.findOne.mockResolvedValue(mockSupplier);
      mockRepository.create.mockReturnValue(mockOrder);
      mockRepository.save.mockResolvedValue(mockOrder);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', { supplierId: 'supplier-1', totalAmount: 1000 }, 'user-1', 'user@test.com');
      expect(result).toEqual(mockOrder);
    });

    it('should throw when supplier not found', async () => {
      mockSupplierRepository.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', { supplierId: 'bad', totalAmount: 1000 })).rejects.toThrow(BadRequestException);
    });

    it('should handle audit failure gracefully', async () => {
      const mockOrder = createMockOrder();
      mockSupplierRepository.findOne.mockResolvedValue(mockSupplier);
      mockRepository.create.mockReturnValue(mockOrder);
      mockRepository.save.mockResolvedValue(mockOrder);
      mockAuditService.log.mockRejectedValue(new Error('Audit failed'));

      const result = await service.create('business-1', { supplierId: 'supplier-1', totalAmount: 1000 });
      expect(result).toEqual(mockOrder);
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      const mockOrders = [createMockOrder()];
      mockRepository.find.mockResolvedValue(mockOrders);
      const result = await service.findAll('business-1');
      expect(result).toEqual(mockOrders);
    });

    it('should filter by status', async () => {
      mockRepository.find.mockResolvedValue([createMockOrder()]);
      const result = await service.findAll('business-1', 'pending');
      expect(repository.find).toHaveBeenCalledWith({ where: { businessId: 'business-1', status: 'pending' }, order: { date: 'DESC' } });
    });
  });

  describe('findOne', () => {
    it('should return order by id', async () => {
      const mockOrder = createMockOrder();
      mockRepository.findOne.mockResolvedValue(mockOrder);
      const result = await service.findOne('po-1', 'business-1');
      expect(result).toEqual(mockOrder);
    });

    it('should throw when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update order', async () => {
      mockRepository.findOne.mockResolvedValue(createMockOrder());
      mockRepository.save.mockImplementation(o => Promise.resolve(o));

      const result = await service.update('po-1', 'business-1', { notes: 'Updated' });
      expect(result.notes).toBe('Updated');
    });

    it('should throw when updating received order', async () => {
      mockRepository.findOne.mockResolvedValue({ ...createMockOrder(), status: 'received' });
      await expect(service.update('po-1', 'business-1', { notes: 'Updated' })).rejects.toThrow(BadRequestException);
    });

    it('should validate supplier when updating', async () => {
      mockRepository.findOne.mockResolvedValue(createMockOrder());
      mockSupplierRepository.findOne.mockResolvedValue(null);
      await expect(service.update('po-1', 'business-1', { supplierId: 'bad' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('markAsReceived', () => {
    it('should mark order as received', async () => {
      mockRepository.findOne.mockResolvedValue(createMockOrder());
      queryRunner.manager.save.mockResolvedValue({ ...createMockOrder(), status: 'received' });
      mockProductRepository.findOne.mockResolvedValue({ id: 'prod-1', quantity: 10, productType: 'storable' });
      mockAuditService.log.mockResolvedValue(undefined);
      mockNotificationService.create.mockResolvedValue(undefined);

      const result = await service.markAsReceived('po-1', 'business-1', { receivedDate: new Date(), items: [{ productId: 'prod-1', quantity: 5, unitPrice: 100 }] });
      expect(result.status).toBe('received');
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw when order already received', async () => {
      mockRepository.findOne.mockResolvedValue({ ...createMockOrder(), status: 'received' });
      await expect(service.markAsReceived('po-1', 'business-1', { receivedDate: new Date() })).rejects.toThrow(BadRequestException);
    });

    it('should throw when order cancelled', async () => {
      mockRepository.findOne.mockResolvedValue({ ...createMockOrder(), status: 'cancelled' });
      await expect(service.markAsReceived('po-1', 'business-1', { receivedDate: new Date() })).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel order', async () => {
      const mockOrder = createMockOrder();
      mockRepository.findOne.mockResolvedValue(mockOrder);
      mockRepository.save.mockImplementation(order => Promise.resolve({ ...order, status: 'cancelled' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.cancel('po-1', 'business-1', 'user-1', 'user@test.com');
      expect(result.status).toBe('cancelled');
    });

    it('should throw when cancelling received order', async () => {
      mockRepository.findOne.mockResolvedValue({ ...createMockOrder(), status: 'received' });
      await expect(service.cancel('po-1', 'business-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove order', async () => {
      mockRepository.findOne.mockResolvedValue(createMockOrder());
      mockRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('po-1', 'business-1', 'user-1', 'user@test.com');
      expect(repository.remove).toHaveBeenCalled();
    });
  });
});
