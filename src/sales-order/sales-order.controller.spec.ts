import { Test, TestingModule } from '@nestjs/testing';
import { SalesOrderController } from './sales-order.controller';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderPdfService } from './sales-order-pdf.service';
import { InvoiceService } from '../invoice/invoice.service';
import { EmailService } from '../shared/services/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalesOrderStatus } from './entities/sales-order.entity';

describe('SalesOrderController', () => {
  let controller: SalesOrderController;
  let service: SalesOrderService;

  const mockSalesOrderService = {
    create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), remove: jest.fn(), confirm: jest.fn(),
    deliver: jest.fn(), cancel: jest.fn(), duplicate: jest.fn(),
    convertToInvoice: jest.fn(),
  };
  const mockSalesOrderPdfService = { generateSalesOrderPdf: jest.fn() };
  const mockInvoiceService = {};
  const mockEmailService = { sendSalesOrderEmail: jest.fn() };

  const mockOrder = {
    id: 'so-1', salesOrderNumber: 'SO-2024-001', clientId: 'client-1',
    businessId: 'business-1', status: SalesOrderStatus.DRAFT, totalAmount: 1190,
  };

  const mockRequest = { user: { id: 'user-1', email: 'user@test.com', businessId: 'business-1' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesOrderController],
      providers: [
        { provide: SalesOrderService, useValue: mockSalesOrderService },
        { provide: SalesOrderPdfService, useValue: mockSalesOrderPdfService },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<SalesOrderController>(SalesOrderController);
    service = module.get<SalesOrderService>(SalesOrderService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create sales order', async () => {
      mockSalesOrderService.create.mockResolvedValue(mockOrder);
      const result = await controller.create({ clientId: 'client-1', items: [] } as any, mockRequest);
      expect(service.create).toHaveBeenCalledWith('business-1', { clientId: 'client-1', items: [] }, 'user-1', 'user@test.com');
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      mockSalesOrderService.findAll.mockResolvedValue([mockOrder]);
      const result = await controller.findAll(mockRequest);
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findOne', () => {
    it('should return order', async () => {
      mockSalesOrderService.findOne.mockResolvedValue(mockOrder);
      const result = await controller.findOne('so-1', mockRequest);
      expect(result).toEqual(mockOrder);
    });
  });

  describe('update', () => {
    it('should update order', async () => {
      mockSalesOrderService.update.mockResolvedValue({ ...mockOrder, notes: 'Updated' });
      const result = await controller.update('so-1', { notes: 'Updated' } as any, mockRequest);
      expect(service.update).toHaveBeenCalledWith('so-1', 'business-1', { notes: 'Updated' }, 'user-1', 'user@test.com');
    });
  });

  describe('remove', () => {
    it('should remove order', async () => {
      mockSalesOrderService.remove.mockResolvedValue(undefined);
      await controller.remove('so-1', mockRequest);
      expect(service.remove).toHaveBeenCalledWith('so-1', 'business-1', 'user-1', 'user@test.com');
    });
  });

  describe('confirm', () => {
    it('should confirm order', async () => {
      mockSalesOrderService.confirm.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CONFIRMED });
      const result = await controller.confirm('so-1', mockRequest);
      expect(result.status).toBe(SalesOrderStatus.CONFIRMED);
    });
  });

  describe('deliver', () => {
    it('should deliver order', async () => {
      mockSalesOrderService.deliver.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.DELIVERED });
      const result = await controller.deliver('so-1', mockRequest);
      expect(result.status).toBe(SalesOrderStatus.DELIVERED);
    });
  });

  describe('cancel', () => {
    it('should cancel order', async () => {
      mockSalesOrderService.cancel.mockResolvedValue({ ...mockOrder, status: SalesOrderStatus.CANCELLED });
      const result = await controller.cancel('so-1', mockRequest);
      expect(result.status).toBe(SalesOrderStatus.CANCELLED);
    });
  });

  describe('duplicate', () => {
    it('should duplicate', async () => {
      mockSalesOrderService.duplicate.mockResolvedValue({ ...mockOrder, id: 'so-2' });
      const result = await controller.duplicate('so-1', mockRequest);
      expect(result.id).toBe('so-2');
    });
  });

  describe('convertToInvoice', () => {
    it('should convert to invoice', async () => {
      mockSalesOrderService.convertToInvoice.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.convertToInvoice('so-1', mockRequest);
      expect(result.id).toBe('inv-1');
    });
  });
});
