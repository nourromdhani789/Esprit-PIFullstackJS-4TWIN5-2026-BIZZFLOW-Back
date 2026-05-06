import { Test, TestingModule } from '@nestjs/testing';
import { StockTakeController } from './stock-take.controller';
import { StockTakeService } from './stock-take.service';

describe('StockTakeController', () => {
  let controller: StockTakeController;

  const mockStockTakeService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findWithItems: jest.fn(),
    update: jest.fn(),
    startStockTake: jest.fn(),
    addOrUpdateItem: jest.fn(),
    updateItem: jest.fn(),
    completeStockTake: jest.fn(),
    cancel: jest.fn(),
    delete: jest.fn(),
  };

  const mockReq = { user: { businessId: 'biz-1', id: 'user-1', email: 'test@test.com' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockTakeController],
      providers: [{ provide: StockTakeService, useValue: mockStockTakeService }],
    }).compile();

    controller = module.get<StockTakeController>(StockTakeController);
    jest.clearAllMocks();
  });

  it('should create stock take', async () => {
    mockStockTakeService.create.mockResolvedValue({ id: 'st-1' });
    const result = await controller.create({ name: 'Count' }, mockReq);
    expect(mockStockTakeService.create).toHaveBeenCalledWith('biz-1', { name: 'Count' });
  });

  it('should find all', async () => {
    mockStockTakeService.findAll.mockResolvedValue([]);
    await controller.findAll(mockReq);
    expect(mockStockTakeService.findAll).toHaveBeenCalledWith('biz-1');
  });

  it('should find one with items', async () => {
    mockStockTakeService.findWithItems.mockResolvedValue({ stockTake: {}, items: [] });
    await controller.findOne('st-1', mockReq);
    expect(mockStockTakeService.findWithItems).toHaveBeenCalledWith('st-1', 'biz-1');
  });

  it('should update', async () => {
    mockStockTakeService.update.mockResolvedValue({ id: 'st-1' });
    await controller.update('st-1', { name: 'Updated' }, mockReq);
    expect(mockStockTakeService.update).toHaveBeenCalledWith('st-1', 'biz-1', { name: 'Updated' });
  });

  it('should start stock take', async () => {
    mockStockTakeService.startStockTake.mockResolvedValue({ status: 'in_progress' });
    await controller.start('st-1', mockReq);
    expect(mockStockTakeService.startStockTake).toHaveBeenCalledWith('st-1', 'biz-1');
  });

  it('should add item', async () => {
    mockStockTakeService.addOrUpdateItem.mockResolvedValue({ id: 'item-1' });
    await controller.addItem('st-1', { productId: 'p1', countedQuantity: 5 }, mockReq);
    expect(mockStockTakeService.addOrUpdateItem).toHaveBeenCalledWith('st-1', 'biz-1', { productId: 'p1', countedQuantity: 5 }, 'user-1', 'test@test.com');
  });

  it('should update item', async () => {
    mockStockTakeService.updateItem.mockResolvedValue({ id: 'item-1' });
    await controller.updateItem('item-1', { countedQuantity: 10 }, mockReq);
    expect(mockStockTakeService.updateItem).toHaveBeenCalledWith('item-1', 'biz-1', { countedQuantity: 10 }, 'user-1', 'test@test.com');
  });

  it('should complete stock take', async () => {
    mockStockTakeService.completeStockTake.mockResolvedValue({ stockTake: { status: 'completed' }, adjustments: [] });
    await controller.complete('st-1', { action: 'adjust' }, mockReq);
    expect(mockStockTakeService.completeStockTake).toHaveBeenCalledWith('st-1', 'biz-1', { action: 'adjust' }, 'user-1', 'test@test.com');
  });

  it('should cancel', async () => {
    mockStockTakeService.cancel.mockResolvedValue({ status: 'cancelled' });
    await controller.cancel('st-1', mockReq);
    expect(mockStockTakeService.cancel).toHaveBeenCalledWith('st-1', 'biz-1', 'user-1', 'test@test.com');
  });

  it('should delete', async () => {
    mockStockTakeService.delete.mockResolvedValue(undefined);
    await controller.delete('st-1', mockReq);
    expect(mockStockTakeService.delete).toHaveBeenCalledWith('st-1', 'biz-1', 'user-1', 'test@test.com');
  });
});
