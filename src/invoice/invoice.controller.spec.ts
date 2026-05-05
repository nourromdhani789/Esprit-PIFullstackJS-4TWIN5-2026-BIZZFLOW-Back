import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { PdfService } from './services/pdf.service';
import { EmailService } from '../shared/services/email.service';
import { AiScannerService } from '../expense/services/ai-scanner.service';
import { ClientService } from '../client/client.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BadRequestException } from '@nestjs/common';

describe('InvoiceController', () => {
  let controller: InvoiceController;
  let service: InvoiceService;

  const mockInvoiceService = {
    create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), updateStatus: jest.fn(), remove: jest.fn(), generatePdf: jest.fn(),
  };
  const mockPdfService = { generateInvoicePdf: jest.fn() };
  const mockEmailService = { sendInvoiceEmail: jest.fn() };
  const mockAiScannerService = { scanReceipt: jest.fn() };
  const mockClientService = { update: jest.fn() };

  const mockInvoice = {
    id: 'invoice-1', invoiceNumber: 'INV-2024-001', clientId: 'client-1',
    businessId: 'business-1', status: 'draft', totalAmount: 1190,
    client: { id: 'client-1', name: 'Test Client', email: 'client@test.com' },
    items: [],
  };

  const mockRequest = {
    user: { id: 'user-1', email: 'user@test.com', businessId: 'business-1' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [
        { provide: InvoiceService, useValue: mockInvoiceService },
        { provide: PdfService, useValue: mockPdfService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: AiScannerService, useValue: mockAiScannerService },
        { provide: ClientService, useValue: mockClientService },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true }).compile();

    controller = module.get<InvoiceController>(InvoiceController);
    service = module.get<InvoiceService>(InvoiceService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an invoice', async () => {
      const createDto = { clientId: 'client-1', items: [{ quantity: 1, price: 100, description: 'Item' }] };
      mockInvoiceService.create.mockResolvedValue(mockInvoice);

      const result = await controller.create(createDto as any, mockRequest);
      expect(result).toEqual(mockInvoice);
      expect(service.create).toHaveBeenCalledWith('business-1', createDto);
    });
  });

  describe('findAll', () => {
    it('should return all invoices', async () => {
      mockInvoiceService.findAll.mockResolvedValue([mockInvoice]);
      const result = await controller.findAll(mockRequest);
      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('findOne', () => {
    it('should return an invoice by id', async () => {
      mockInvoiceService.findOne.mockResolvedValue(mockInvoice);
      const result = await controller.findOne('invoice-1', mockRequest);
      expect(result).toEqual(mockInvoice);
    });
  });

  describe('update', () => {
    it('should update an invoice', async () => {
      const updateDto = { status: 'sent' };
      mockInvoiceService.update.mockResolvedValue({ ...mockInvoice, status: 'sent' });

      const result = await controller.update('invoice-1', updateDto as any, mockRequest);
      expect(service.update).toHaveBeenCalledWith('invoice-1', 'business-1', updateDto, 'user-1', 'user@test.com');
    });
  });

  describe('updateStatus', () => {
    it('should update invoice status', async () => {
      mockInvoiceService.updateStatus.mockResolvedValue({ ...mockInvoice, status: 'paid' });

      const result = await controller.updateStatus('invoice-1', 'paid' as any, mockRequest);
      expect(service.updateStatus).toHaveBeenCalledWith('invoice-1', 'business-1', 'paid', 'user-1', 'user@test.com');
    });
  });

  describe('remove', () => {
    it('should remove an invoice', async () => {
      mockInvoiceService.remove.mockResolvedValue(undefined);
      await controller.remove('invoice-1', mockRequest);
      expect(service.remove).toHaveBeenCalledWith('invoice-1', 'business-1', 'user-1', 'user@test.com');
    });
  });

  describe('sendEmail', () => {
    it('should send invoice email to client email', async () => {
      mockInvoiceService.findOne.mockResolvedValue(mockInvoice);
      mockPdfService.generateInvoicePdf.mockResolvedValue(Buffer.from('pdf'));
      mockEmailService.sendInvoiceEmail.mockResolvedValue(undefined);

      const result = await controller.sendEmail('invoice-1', { email: 'client@test.com' } as any, mockRequest);
      expect(result.message).toContain('sent successfully');
    });

    it('should throw when no recipient email', async () => {
      const invoiceNoEmail = { ...mockInvoice, client: { id: 'client-1', name: 'Test' } };
      mockInvoiceService.findOne.mockResolvedValue(invoiceNoEmail);

      await expect(controller.sendEmail('invoice-1', {} as any, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadScan', () => {
    it('should upload scan and return AI results', async () => {
      const mockFile = { filename: 'scan-123.pdf', path: '/uploads/scans/scan-123.pdf' } as Express.Multer.File;
      const aiResult = { amount: 1190, date: '2024-01-15', supplier: 'Test Client', confidence: 0.95 };
      mockAiScannerService.scanReceipt.mockResolvedValue(aiResult);

      const result = await controller.uploadScan(mockFile, mockRequest);
      expect(result.scanUrl).toBe('/uploads/scans/scan-123.pdf');
      expect(result.aiExtracted.totalAmount).toBe(1190);
    });

    it('should throw when no file uploaded', async () => {
      await expect(controller.uploadScan(undefined as any, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });
});
