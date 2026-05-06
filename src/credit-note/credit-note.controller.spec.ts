import { Test, TestingModule } from '@nestjs/testing';
import { CreditNoteController } from './credit-note.controller';
import { CreditNoteService } from './credit-note.service';

describe('CreditNoteController', () => {
  let controller: CreditNoteController;

  const mockService = {
    create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), approve: jest.fn(), apply: jest.fn(),
    refund: jest.fn(), cancel: jest.fn(), remove: jest.fn(), getSummary: jest.fn(),
  };
  const mockReq = { user: { businessId: 'biz-1', id: 'user-1', email: 'test@test.com' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreditNoteController],
      providers: [{ provide: CreditNoteService, useValue: mockService }],
    }).compile();
    controller = module.get<CreditNoteController>(CreditNoteController);
    jest.clearAllMocks();
  });

  it('should create', async () => {
    mockService.create.mockResolvedValue({ id: 'cn-1' });
    await controller.create({ invoiceId: 'inv-1', amount: 100 }, mockReq);
    expect(mockService.create).toHaveBeenCalledWith('biz-1', { invoiceId: 'inv-1', amount: 100 }, 'user-1', 'test@test.com');
  });

  it('should find all', async () => {
    mockService.findAll.mockResolvedValue([]);
    await controller.findAll('draft', mockReq);
    expect(mockService.findAll).toHaveBeenCalledWith('biz-1', 'draft');
  });

  it('should find one', async () => {
    mockService.findOne.mockResolvedValue({ id: 'cn-1' });
    await controller.findOne('cn-1', mockReq);
    expect(mockService.findOne).toHaveBeenCalledWith('cn-1', 'biz-1');
  });

  it('should update', async () => {
    mockService.update.mockResolvedValue({ id: 'cn-1' });
    await controller.update('cn-1', { reason: 'Updated' }, mockReq);
    expect(mockService.update).toHaveBeenCalledWith('cn-1', 'biz-1', { reason: 'Updated' }, 'user-1', 'test@test.com');
  });

  it('should approve', async () => {
    mockService.approve.mockResolvedValue({ id: 'cn-1', status: 'approved' });
    await controller.approve('cn-1', mockReq);
    expect(mockService.approve).toHaveBeenCalledWith('cn-1', 'biz-1', 'user-1', 'test@test.com');
  });

  it('should apply', async () => {
    mockService.apply.mockResolvedValue({ id: 'cn-1', status: 'applied' });
    await controller.apply('cn-1', mockReq);
    expect(mockService.apply).toHaveBeenCalledWith('cn-1', 'biz-1', 'user-1', 'test@test.com');
  });

  it('should refund', async () => {
    mockService.refund.mockResolvedValue({ id: 'cn-1', status: 'refunded' });
    await controller.refund('cn-1', mockReq);
    expect(mockService.refund).toHaveBeenCalledWith('cn-1', 'biz-1', 'user-1', 'test@test.com');
  });

  it('should cancel', async () => {
    mockService.cancel.mockResolvedValue({ id: 'cn-1', status: 'cancelled' });
    await controller.cancel('cn-1', mockReq);
    expect(mockService.cancel).toHaveBeenCalledWith('cn-1', 'biz-1', 'user-1', 'test@test.com');
  });

  it('should remove', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('cn-1', mockReq);
    expect(mockService.remove).toHaveBeenCalledWith('cn-1', 'biz-1', 'user-1', 'test@test.com');
  });

  it('should get summary', async () => {
    mockService.getSummary.mockResolvedValue({ totalActive: 100 });
    await controller.getSummary(mockReq);
    expect(mockService.getSummary).toHaveBeenCalledWith('biz-1');
  });
});
