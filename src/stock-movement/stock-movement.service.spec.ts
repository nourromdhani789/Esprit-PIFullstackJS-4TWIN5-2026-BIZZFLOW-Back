import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementService } from './stock-movement.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { Product } from '../product/entities/product.entity';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';

describe('StockMovementService', () => {
  let service: StockMovementService;
  let movementRepo: Repository<StockMovement>;
  let productRepo: Repository<Product>;

  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockMovementRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn(() => queryBuilder) };
  const mockProductRepo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn() };
  const mockAuditService = { log: jest.fn() };

  const mockMovement = {
    id: 'sm-1', productId: 'prod-1', type: 'IN' as const, quantity: 50,
    reason: 'purchase', notes: 'Test', referenceId: 'po-1',
    businessId: 'business-1', date: new Date(), createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockMovementService,
        { provide: getRepositoryToken(StockMovement), useValue: mockMovementRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<StockMovementService>(StockMovementService);
    movementRepo = module.get<Repository<StockMovement>>(getRepositoryToken(StockMovement));
    productRepo = module.get<Repository<Product>>(getRepositoryToken(Product));
    jest.clearAllMocks();
    queryBuilder.getMany.mockReset();
  });

  describe('create', () => {
    it('should create IN stock movement', async () => {
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', name: 'Test Product', quantity: 10 });
      mockMovementRepo.create.mockReturnValue(mockMovement);
      mockMovementRepo.save.mockResolvedValue(mockMovement);
      mockProductRepo.save.mockResolvedValue(undefined);

      const result = await service.create('business-1', { productId: 'prod-1', type: 'IN', quantity: 50, reason: 'purchase' }, 'user-1');
      expect(result).toEqual(mockMovement);
    });

    it('should create OUT stock movement with sufficient stock', async () => {
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', name: 'Test', quantity: 100 });
      mockMovementRepo.create.mockReturnValue({ ...mockMovement, type: 'OUT' });
      mockMovementRepo.save.mockResolvedValue({ ...mockMovement, type: 'OUT' });
      mockProductRepo.save.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', { productId: 'prod-1', type: 'OUT', quantity: 50, reason: 'adjustment' }, 'user-1');
      expect(result.type).toBe('OUT');
    });

    it('should throw when product not found', async () => {
      mockProductRepo.findOne.mockResolvedValue(null);
      await expect(service.create('business-1', { productId: 'bad', type: 'IN', quantity: 50, reason: 'purchase' })).rejects.toThrow(NotFoundException);
    });

    it('should throw when insufficient stock for OUT', async () => {
      mockProductRepo.findOne.mockResolvedValue({ id: 'prod-1', name: 'Test', quantity: 10 });
      await expect(service.create('business-1', { productId: 'prod-1', type: 'OUT', quantity: 50, reason: 'sale' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all movements', async () => {
      queryBuilder.getMany.mockResolvedValue([mockMovement]);
      const result = await service.findAll('business-1');
      expect(result).toEqual([mockMovement]);
    });

    it('should apply type filter', async () => {
      queryBuilder.getMany.mockResolvedValue([mockMovement]);
      await service.findAll('business-1', { type: 'IN' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('movement.type = :type', { type: 'IN' });
    });

    it('should apply productId filter', async () => {
      queryBuilder.getMany.mockResolvedValue([mockMovement]);
      await service.findAll('business-1', { productId: 'prod-1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('movement.productId = :productId', { productId: 'prod-1' });
    });
  });

  describe('findOne', () => {
    it('should return movement by id', async () => {
      mockMovementRepo.findOne.mockResolvedValue(mockMovement);
      const result = await service.findOne('sm-1', 'business-1');
      expect(result).toEqual(mockMovement);
    });

    it('should throw when not found', async () => {
      mockMovementRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductStockHistory', () => {
    it('should return stock history for product', async () => {
      mockMovementRepo.find.mockResolvedValue([mockMovement]);
      const result = await service.getProductStockHistory('prod-1', 'business-1');
      expect(result).toEqual([mockMovement]);
      expect(movementRepo.find).toHaveBeenCalledWith({
        where: { productId: 'prod-1', businessId: 'business-1' },
        order: { date: 'DESC' },
        relations: ['product'],
      });
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with low stock', async () => {
      mockProductRepo.find.mockResolvedValue([
        { id: 'prod-1', name: 'Low Stock', quantity: 5, minimumStock: 10, price: 100 },
        { id: 'prod-2', name: 'OK Stock', quantity: 20, minimumStock: 10, price: 100 },
      ]);

      const result = await service.getLowStockProducts('business-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Low Stock');
    });
  });
});
