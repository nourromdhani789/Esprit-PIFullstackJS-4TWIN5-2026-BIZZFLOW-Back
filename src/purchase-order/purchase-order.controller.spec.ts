import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';

describe('PurchaseOrderController', () => {
  let controller: PurchaseOrderController;

  const mockService = {
    create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), markAsReceived: jest.fn(), cancel: jest.fn(), remove: jest.fn(),
  };
  const mockReq = { user: { businessId: 'biz-1', id: 'user-1', email: 'test@test.com' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [{ provide: PurchaseOrderService, useValue: mockService }],
    }).compile();
    controller = module.get<PurchaseOrderController>(PurchaseOrderController);
    jest.clearAllMocks();
  });

  it('should create', async () => {
    mockService.create.mockResolvedValue({ id: 'po-1' });
    await controller.create({ supplierId: 's1', items: [] }, mockReq);
    expect(mockService.create).toHaveBeenCalledWith('biz-1', { supplierId: 's1', items: [] }, 'user-1', 'test@test.com');
  });

  it('should find all', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll('pending', mockReq);
    expect(mockService.findAll).toHaveBeenCalledWith('biz-1', 'pending');
  });

  it('should find one', async () => {
    mockService.findOne.mockResolvedValue({ id: 'po-1' });
    await controller.findOne('po-1', mockReq);
    expect(mockService.findOne).toHaveBeenCalledWith('po-1', 'biz-1');
  });

  it('should update', async () => {
    mockService.update.mockResolvedValue({ id: 'po-1' });
    await controller.update('po-1', { status: 'approved' }, mockReq);
    expect(mockService.update).toHaveBeenCalledWith('po-1', 'biz-1', { status: 'approved' }, 'user-1', 'test@test.com');
  });

  it('should mark as received', async () => {
    mockService.markAsReceived.mockResolvedValue({ id: 'po-1', status: 'received' });
    await controller.markAsReceived('po-1', { receivedItems: [] }, mockReq);
    expect(mockService.markAsReceived).toHaveBeenCalledWith('po-1', 'biz-1', { receivedItems: [] }, 'user-1', 'test@test.com');
  });

  it('should cancel', async () => {
    mockService.cancel.mockResolvedValue({ id: 'po-1', status: 'cancelled' });
    await controller.cancel('po-1', mockReq);
    expect(mockService.cancel).toHaveBeenCalledWith('po-1', 'biz-1', 'user-1', 'test@test.com');
  });

  it('should remove', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('po-1', mockReq);
    expect(mockService.remove).toHaveBeenCalledWith('po-1', 'biz-1', 'user-1', 'test@test.com');
  });
});
