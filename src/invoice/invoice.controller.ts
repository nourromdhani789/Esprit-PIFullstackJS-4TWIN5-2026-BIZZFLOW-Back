import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto, UpdateInvoiceDto, SendInvoiceEmailDto } from './dto/invoice.dto';
import { InvoiceStatus } from './entities/invoice.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PdfService } from './services/pdf.service';
import { EmailService } from '../shared/services/email.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
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
    return this.invoiceService.update(id, req.user.businessId, updateInvoiceDto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: InvoiceStatus, @Request() req) {
    return this.invoiceService.updateStatus(id, req.user.businessId, status);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.invoiceService.remove(id, req.user.businessId);
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
    const pdfBuffer = await this.pdfService.generateInvoicePdf(invoice);
    await this.emailService.sendInvoiceEmail(sendDto.email, invoice, pdfBuffer, sendDto.subject, sendDto.message);
    return { message: 'Invoice sent successfully' };
  }
}
