import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementController } from './stock-movement.controller';
import { StockMovementService } from './stock-movement.service';

describe('StockMovementController', () => {
  let controller: StockMovementController;

  const mockService = {
    create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(),
    getProductStockHistory: jest.fn(), getLowStockProducts: jest.fn(),
  };
  const mockReq = { user: { businessId: 'biz-1', id: 'user-1', email: 'test@test.com' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockMovementController],
      providers: [{ provide: StockMovementService, useValue: mockService }],
    }).compile();
    controller = module.get<StockMovementController>(StockMovementController);
    jest.clearAllMocks();
  });

  it('should create', async () => {
    mockService.create.mockResolvedValue({ id: 'sm-1' });
    await controller.create({ productId: 'p1', type: 'IN', quantity: 10, reason: 'restock' } as any, mockReq);
    expect(mockService.create).toHaveBeenCalledWith('biz-1', expect.any(Object), 'user-1', 'test@test.com');
  });

  it('should find all with filters', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll({ type: 'IN' } as any, mockReq);
    expect(mockService.findAll).toHaveBeenCalledWith('biz-1', { type: 'IN' });
  });

  it('should find one', async () => {
    mockService.findOne.mockResolvedValue({ id: 'sm-1' });
    await controller.findOne('sm-1', mockReq);
    expect(mockService.findOne).toHaveBeenCalledWith('sm-1', 'biz-1');
  });

  it('should get product stock history', async () => {
    mockService.getProductStockHistory.mockResolvedValue([]);
    await controller.getProductStockHistory('p1', mockReq);
    expect(mockService.getProductStockHistory).toHaveBeenCalledWith('p1', 'biz-1');
  });

  it('should get low stock products', async () => {
    mockService.getLowStockProducts.mockResolvedValue([]);
    await controller.getLowStockProducts(mockReq);
    expect(mockService.getLowStockProducts).toHaveBeenCalledWith('biz-1');
  });
});
