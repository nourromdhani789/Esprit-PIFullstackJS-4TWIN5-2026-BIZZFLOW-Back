import { Test, TestingModule } from '@nestjs/testing';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { QuotePdfService } from './quote-pdf.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { InvoiceService } from '../invoice/invoice.service';
import { EmailService } from '../shared/services/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuoteStatus } from './entities/quote.entity';
import { BadRequestException } from '@nestjs/common';

describe('QuoteController', () => {
  let controller: QuoteController;
  let quoteService: QuoteService;

  const mockQuoteService = {
    create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), remove: jest.fn(), markAsSent: jest.fn(),
    markAsAccepted: jest.fn(), markAsRejected: jest.fn(), duplicate: jest.fn(),
    convertToSalesOrder: jest.fn(), convertToInvoice: jest.fn(),
  };
  const mockQuotePdfService = { generateQuotePdf: jest.fn() };
  const mockSalesOrderService = {};
  const mockInvoiceService = {};
  const mockEmailService = { sendQuoteEmail: jest.fn() };

  const mockQuote = {
    id: 'quote-1', quoteNumber: 'QUO-2024-001', clientId: 'client-1',
    businessId: 'business-1', status: QuoteStatus.DRAFT, totalAmount: 1190,
    client: { email: 'client@test.com' },
  };

  const mockRequest = { user: { id: 'user-1', email: 'user@test.com', businessId: 'business-1' } };
  const mockResponse = { setHeader: jest.fn(), send: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        { provide: QuoteService, useValue: mockQuoteService },
        { provide: QuotePdfService, useValue: mockQuotePdfService },
        { provide: SalesOrderService, useValue: mockSalesOrderService },
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<QuoteController>(QuoteController);
    quoteService = module.get<QuoteService>(QuoteService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create quote', async () => {
      mockQuoteService.create.mockResolvedValue(mockQuote);
      const result = await controller.create({ clientId: 'client-1', items: [] } as any, mockRequest);
      expect(quoteService.create).toHaveBeenCalledWith('business-1', { clientId: 'client-1', items: [] }, 'user-1', 'user@test.com');
    });
  });

  describe('findAll', () => {
    it('should return all quotes', async () => {
      mockQuoteService.findAll.mockResolvedValue([mockQuote]);
      const result = await controller.findAll(mockRequest);
      expect(result).toEqual([mockQuote]);
    });
  });

  describe('findOne', () => {
    it('should return quote', async () => {
      mockQuoteService.findOne.mockResolvedValue(mockQuote);
      const result = await controller.findOne('quote-1', mockRequest);
      expect(result).toEqual(mockQuote);
    });
  });

  describe('update', () => {
    it('should update quote', async () => {
      mockQuoteService.update.mockResolvedValue({ ...mockQuote, notes: 'Updated' });
      const result = await controller.update('quote-1', { notes: 'Updated' } as any, mockRequest);
      expect(quoteService.update).toHaveBeenCalledWith('quote-1', 'business-1', { notes: 'Updated' }, 'user-1', 'user@test.com');
    });
  });

  describe('remove', () => {
    it('should remove quote', async () => {
      mockQuoteService.remove.mockResolvedValue(undefined);
      await controller.remove('quote-1', mockRequest);
      expect(quoteService.remove).toHaveBeenCalledWith('quote-1', 'business-1', 'user-1', 'user@test.com');
    });
  });

  describe('markAsSent', () => {
    it('should mark as sent', async () => {
      mockQuoteService.markAsSent.mockResolvedValue({ ...mockQuote, status: QuoteStatus.SENT });
      const result = await controller.markAsSent('quote-1', mockRequest);
      expect(result.status).toBe(QuoteStatus.SENT);
    });
  });

  describe('markAsAccepted', () => {
    it('should mark as accepted', async () => {
      mockQuoteService.markAsAccepted.mockResolvedValue({ ...mockQuote, status: QuoteStatus.ACCEPTED });
      const result = await controller.markAsAccepted('quote-1', mockRequest);
      expect(result.status).toBe(QuoteStatus.ACCEPTED);
    });
  });

  describe('markAsRejected', () => {
    it('should mark as rejected', async () => {
      mockQuoteService.markAsRejected.mockResolvedValue({ ...mockQuote, status: QuoteStatus.REJECTED });
      const result = await controller.markAsRejected('quote-1', mockRequest);
      expect(result.status).toBe(QuoteStatus.REJECTED);
    });
  });

  describe('duplicate', () => {
    it('should duplicate', async () => {
      mockQuoteService.duplicate.mockResolvedValue({ ...mockQuote, id: 'quote-2' });
      const result = await controller.duplicate('quote-1', mockRequest);
      expect(result.id).toBe('quote-2');
    });
  });

  describe('downloadPdf', () => {
    it('should download pdf', async () => {
      mockQuoteService.findOne.mockResolvedValue(mockQuote);
      mockQuotePdfService.generateQuotePdf.mockResolvedValue(Buffer.from('pdf'));

      await controller.downloadPdf('quote-1', mockRequest, mockResponse as any);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.send).toHaveBeenCalled();
    });
  });

  describe('sendEmail', () => {
    it('should send email', async () => {
      mockQuoteService.findOne.mockResolvedValue(mockQuote);
      mockQuotePdfService.generateQuotePdf.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendQuoteEmail.mockResolvedValue(undefined);

      const result = await controller.sendEmail('quote-1', { email: 'test@test.com', subject: 'Quote', message: 'Hi' }, mockRequest);
      expect(result.message).toContain('sent successfully');
    });

    it('should throw when no email', async () => {
      mockQuoteService.findOne.mockResolvedValue({ ...mockQuote, client: { email: null } });
      await expect(controller.sendEmail('quote-1', {} as any, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('convertToSalesOrder', () => {
    it('should convert to sales order', async () => {
      mockQuoteService.convertToSalesOrder.mockResolvedValue({ id: 'so-1' });
      const result = await controller.convertToSalesOrder('quote-1', mockRequest);
      expect(result.id).toBe('so-1');
    });
  });

  describe('convertToInvoice', () => {
    it('should convert to invoice', async () => {
      mockQuoteService.convertToInvoice.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.convertToInvoice('quote-1', mockRequest);
      expect(result.id).toBe('inv-1');
    });
  });
});
