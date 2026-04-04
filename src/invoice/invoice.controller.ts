import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Res, HttpCode, HttpStatus, BadRequestException, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response as ExpressResponse } from 'express';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, UpdateInvoiceDto, SendInvoiceEmailDto } from './dto/invoice.dto';
import { InvoiceStatus } from './entities/invoice.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PdfService } from './services/pdf.service';
import { EmailService } from '../shared/services/email.service';
import { AiScannerService } from '../expense/services/ai-scanner.service';
import { ClientService } from '../client/client.service';

const scanStorage = diskStorage({
  destination: './uploads/scans',
  filename: (req, file, callback) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    callback(null, `scan-${uniqueSuffix}${ext}`);
  },
});

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
    private readonly aiScannerService: AiScannerService,
    private readonly clientService: ClientService,
  ) {}

  @Post()
  create(@Body() createInvoiceDto: CreateInvoiceDto, @Request() req) {
    return this.invoiceService.create(req.user.businessId, createInvoiceDto);
  }

  @Get()
  findAll(@Request() req) {
    return this.invoiceService.findAll(req.user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.invoiceService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto, @Request() req) {
    return this.invoiceService.update(id, req.user.businessId, updateInvoiceDto, req.user.id, req.user.email);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: InvoiceStatus, @Request() req) {
    return this.invoiceService.updateStatus(id, req.user.businessId, status, req.user.id, req.user.email);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.invoiceService.remove(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Request() req, @Res() res: ExpressResponse) {
    const invoice = await this.invoiceService.findOne(id, req.user.businessId);
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  }

  @Post(':id/send-email')
  @HttpCode(HttpStatus.OK)
  async sendEmail(@Param('id') id: string, @Body() sendDto: SendInvoiceEmailDto, @Request() req) {
    const invoice = await this.invoiceService.findOne(id, req.user.businessId);
    
    // Determine recipient email
    let recipientEmail = sendDto.email || invoice.client?.email;
    
    if (!recipientEmail) {
      throw new BadRequestException('Client has no email. Please provide one.');
    }
    
    // If email was provided via modal and client doesn't have one, save it to client
    if (sendDto.email && !invoice.client?.email && invoice.client?.id) {
      await this.clientService.update(invoice.client.id, req.user.businessId, { email: sendDto.email });
    }
    
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
    await this.emailService.sendInvoiceEmail(recipientEmail, invoice, pdfBuffer, sendDto.subject, sendDto.message);
    return { 
      message: `Invoice sent successfully to ${recipientEmail}`,
      recipient: recipientEmail
    };
  }

  @Post('upload-scan')
  @UseInterceptors(
    FileInterceptor('document', {
      storage: scanStorage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, callback) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const ext = extname(file.originalname).toLowerCase();
        const mimetype = allowedTypes.test(file.mimetype);
        const extnameValid = allowedTypes.test(ext.replace('.', ''));
        
        if (mimetype && extnameValid) {
          return callback(null, true);
        }
        callback(new BadRequestException('Only image and PDF files are allowed'), false);
      },
    }),
  )
  async uploadScan(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Get mock AI scan results (adapted for invoice data)
    const aiResult = await this.aiScannerService.scanReceipt(file);

    // Transform to invoice-compatible format
    return {
      scanUrl: `/uploads/scans/${file.filename}`,
      aiExtracted: {
        totalAmount: aiResult.amount,
        date: aiResult.date,
        clientName: aiResult.supplier,
        confidence: aiResult.confidence,
      },
    };
  }
}
