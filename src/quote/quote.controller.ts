import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Res, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { QuoteService } from './quote.service';
import { QuotePdfService } from './quote-pdf.service';
import { SalesOrderService } from '../sales-order/sales-order.service';
import { InvoiceService } from '../invoice/invoice.service';
import { EmailService } from '../shared/services/email.service';
import { CreateQuoteDto, UpdateQuoteDto, SendQuoteEmailDto } from './dto/quote.dto';
import { QuoteStatus } from './entities/quote.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuoteController {
  constructor(
    private readonly quoteService: QuoteService,
    private readonly quotePdfService: QuotePdfService,
    private readonly salesOrderService: SalesOrderService,
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  create(@Body() createQuoteDto: CreateQuoteDto, @Request() req) {
    return this.quoteService.create(req.user.businessId, createQuoteDto, req.user.id, req.user.email);
  }

  @Get()
  findAll(@Request() req) {
    return this.quoteService.findAll(req.user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.quoteService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateQuoteDto: UpdateQuoteDto, @Request() req) {
    return this.quoteService.update(id, req.user.businessId, updateQuoteDto, req.user.id, req.user.email);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.quoteService.remove(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Patch(':id/send')
  markAsSent(@Param('id') id: string, @Request() req) {
    return this.quoteService.markAsSent(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Patch(':id/accept')
  markAsAccepted(@Param('id') id: string, @Request() req) {
    return this.quoteService.markAsAccepted(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Patch(':id/reject')
  markAsRejected(@Param('id') id: string, @Request() req) {
    return this.quoteService.markAsRejected(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Request() req) {
    return this.quoteService.duplicate(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Request() req, @Res() res: ExpressResponse) {
    const quote = await this.quoteService.findOne(id, req.user.businessId);
    const pdfBuffer = await this.quotePdfService.generateQuotePdf(quote);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quote.quoteNumber}.pdf"`);
    res.send(pdfBuffer);
  }

  @Post(':id/send-email')
  @HttpCode(HttpStatus.OK)
  async sendEmail(@Param('id') id: string, @Body() sendDto: SendQuoteEmailDto, @Request() req) {
    const quote = await this.quoteService.findOne(id, req.user.businessId);
    
    let recipientEmail = sendDto.email || quote.client?.email;
    
    if (!recipientEmail) {
      throw new BadRequestException('Client has no email. Please provide one.');
    }
    
    // Generate PDF and send email
    const pdfBuffer = await this.quotePdfService.generateQuotePdf(quote);
    await this.emailService.sendQuoteEmail(recipientEmail, quote, pdfBuffer, sendDto.subject, sendDto.message);
    
    return { 
      message: `Quote sent successfully to ${recipientEmail}`,
      recipient: recipientEmail
    };
  }

  @Post(':id/convert-to-sales-order')
  async convertToSalesOrder(@Param('id') id: string, @Request() req) {
    return this.quoteService.convertToSalesOrder(
      id, 
      req.user.businessId, 
      this.salesOrderService, 
      req.user.id, 
      req.user.email
    );
  }

  @Post(':id/convert-to-invoice')
  async convertToInvoice(@Param('id') id: string, @Request() req) {
    return this.quoteService.convertToInvoice(
      id, 
      req.user.businessId, 
      this.invoiceService, 
      req.user.id, 
      req.user.email
    );
  }
}
