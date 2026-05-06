import { Test, TestingModule } from '@nestjs/testing';
import { StockTakeService } from './stock-take.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StockTake } from './entities/stock-take.entity';
import { StockTakeItem } from './entities/stock-take-item.entity';
import { Product } from '../product/entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

describe('StockTakeService', () => {
  let service: StockTakeService;

  const mockStockTake = {
    id: 'st-1', name: 'Annual Count', description: 'Yearly stock count',
    status: 'draft', businessId: 'biz-1', totalProducts: 0,
    productsCounted: 0, discrepancies: 0, createdAt: new Date(), updatedAt: new Date(),
  };

  const mockItem = {
    id: 'item-1', stockTakeId: 'st-1', productId: 'prod-1', productName: 'Widget',
    systemQuantity: 10, countedQuantity: 8, difference: -2, notes: null,
    isAdjusted: false, businessId: 'biz-1',
  };

  const mockRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), remove: jest.fn(), update: jest.fn() };
  const mockItemRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn() };
  const mockProductRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
  const mockMovementRepo = { create: jest.fn(), save: jest.fn() };
  const mockAuditService = { log: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockTakeService,
        { provide: getRepositoryToken(StockTake), useValue: mockRepo },
        { provide: getRepositoryToken(StockTakeItem), useValue: mockItemRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: getRepositoryToken(StockMovement), useValue: mockMovementRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<StockTakeService>(StockTakeService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a stock take', async () => {
      mockRepo.create.mockReturnValue(mockStockTake);
      mockRepo.save.mockResolvedValue(mockStockTake);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('biz-1', { name: 'Annual Count', description: 'Yearly stock count' }, 'user-1', 'user@test.com');
      expect(result).toEqual(mockStockTake);
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', businessId: 'biz-1' }));
    });
  });

  describe('findAll', () => {
    it('should return all stock takes for business', async () => {
      mockRepo.find.mockResolvedValue([mockStockTake]);
      const result = await service.findAll('biz-1');
      expect(result).toEqual([mockStockTake]);
    });
  });

  describe('findOne', () => {
    it('should return a stock take', async () => {
      mockRepo.findOne.mockResolvedValue(mockStockTake);
      const result = await service.findOne('st-1', 'biz-1');
      expect(result).toEqual(mockStockTake);
    });

    it('should throw when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'biz-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findWithItems', () => {
    it('should return stock take with items', async () => {
      mockRepo.findOne.mockResolvedValue(mockStockTake);
      mockItemRepo.find.mockResolvedValue([mockItem]);
      const result = await service.findWithItems('st-1', 'biz-1');
      expect(result.stockTake).toEqual(mockStockTake);
      expect(result.items).toEqual([mockItem]);
    });
  });

  describe('update', () => {
    it('should update a stock take', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake });
      mockRepo.save.mockImplementation(st => Promise.resolve({ ...st, name: 'Updated' }));
      const result = await service.update('st-1', 'biz-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('startStockTake', () => {
    it('should start a draft stock take', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake });
      mockProductRepo.find.mockResolvedValue([{ id: 'prod-1', name: 'Widget', quantity: 10 }]);
      mockItemRepo.findOne.mockResolvedValue(null);
      mockItemRepo.create.mockReturnValue(mockItem);
      mockItemRepo.save.mockResolvedValue(mockItem);
      mockRepo.save.mockImplementation(st => Promise.resolve({ ...st, status: 'in_progress', totalProducts: 1 }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.startStockTake('st-1', 'biz-1', 'user-1', 'user@test.com');
      expect(result.status).toBe('in_progress');
      expect(result.totalProducts).toBe(1);
    });

    it('should throw when starting non-draft', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'in_progress' });
      await expect(service.startStockTake('st-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('addOrUpdateItem', () => {
    it('should add item to in_progress stock take', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'in_progress' });
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', name: 'Widget', quantity: 10 });
      mockItemRepo.findOne.mockResolvedValue(null);
      mockItemRepo.create.mockReturnValue(mockItem);
      mockItemRepo.save.mockResolvedValue(mockItem);
      mockItemRepo.find.mockResolvedValue([mockItem]);
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.addOrUpdateItem('st-1', 'biz-1', { productId: 'prod-1', countedQuantity: 8 });
      expect(result).toEqual(mockItem);
    });

    it('should update existing item', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'in_progress' });
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', name: 'Widget', quantity: 10 });
      mockItemRepo.findOne.mockResolvedValue({ ...mockItem });
      mockItemRepo.save.mockImplementation(item => Promise.resolve({ ...item }));
      mockItemRepo.find.mockResolvedValue([{ ...mockItem, countedQuantity: 12, difference: 2 }]);
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.addOrUpdateItem('st-1', 'biz-1', { productId: 'prod-1', countedQuantity: 12 });
      expect(result.countedQuantity).toBe(12);
    });

    it('should throw when stock take not in progress', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'draft' });
      await expect(service.addOrUpdateItem('st-1', 'biz-1', { productId: 'prod-1', countedQuantity: 8 }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw when product not found', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'in_progress' });
      mockProductRepo.findOne.mockResolvedValue(null);
      await expect(service.addOrUpdateItem('st-1', 'biz-1', { productId: 'bad', countedQuantity: 8 }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('updateItem', () => {
    it('should update item counted quantity', async () => {
      mockItemRepo.findOne.mockResolvedValue({ ...mockItem });
      mockItemRepo.save.mockImplementation(item => Promise.resolve({ ...item }));
      mockItemRepo.find.mockResolvedValue([{ ...mockItem, countedQuantity: 15, difference: 5 }]);
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.updateItem('item-1', 'biz-1', { countedQuantity: 15 });
      expect(result.countedQuantity).toBe(15);
    });

    it('should throw when item not found', async () => {
      mockItemRepo.findOne.mockResolvedValue(null);
      await expect(service.updateItem('bad', 'biz-1', { countedQuantity: 15 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('completeStockTake', () => {
    it('should complete with adjust action', async () => {
      const stockTakeInProgress = { ...mockStockTake, status: 'in_progress' };
      mockRepo.findOne.mockResolvedValue(stockTakeInProgress);
      mockItemRepo.find.mockResolvedValue([{ ...mockItem, difference: -2, isAdjusted: false }]);
      mockMovementRepo.create.mockReturnValue({ id: 'mov-1', type: 'OUT', quantity: 2 });
      mockMovementRepo.save.mockResolvedValue({ id: 'mov-1', type: 'OUT', quantity: 2 });
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', quantity: 10 });
      mockProductRepo.save.mockResolvedValue({ id: 'prod-1', quantity: 8 });
      mockItemRepo.save.mockResolvedValue({ ...mockItem, isAdjusted: true });
      mockRepo.save.mockImplementation(st => Promise.resolve({ ...st, status: 'completed' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.completeStockTake('st-1', 'biz-1', { action: 'adjust' }, 'user-1', 'user@test.com');
      expect(result.stockTake.status).toBe('completed');
      expect(result.adjustments.length).toBe(1);
    });

    it('should complete without adjustments', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'in_progress' });
      mockItemRepo.find.mockResolvedValue([{ ...mockItem, difference: 0 }]);
      mockRepo.save.mockImplementation(st => Promise.resolve({ ...st, status: 'completed' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.completeStockTake('st-1', 'biz-1', { action: 'keep' }, 'user-1');
      expect(result.stockTake.status).toBe('completed');
      expect(result.adjustments.length).toBe(0);
    });

    it('should throw when not in progress', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'draft' });
      mockItemRepo.find.mockResolvedValue([]);
      await expect(service.completeStockTake('st-1', 'biz-1', { action: 'adjust' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a draft stock take', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'draft' });
      mockRepo.save.mockImplementation(st => Promise.resolve({ ...st, status: 'cancelled' }));
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.cancel('st-1', 'biz-1', 'user-1');
      expect(result.status).toBe('cancelled');
    });

    it('should throw when cancelling completed', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockStockTake, status: 'completed' });
      await expect(service.cancel('st-1', 'biz-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should delete a stock take', async () => {
      mockRepo.findOne.mockResolvedValue(mockStockTake);
      mockRepo.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.delete('st-1', 'biz-1', 'user-1');
      expect(mockRepo.remove).toHaveBeenCalledWith(mockStockTake);
    });
  });
});
