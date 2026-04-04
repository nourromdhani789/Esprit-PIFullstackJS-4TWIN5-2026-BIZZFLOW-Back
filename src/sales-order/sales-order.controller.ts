import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Res, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { SalesOrderService } from './sales-order.service';
import { SalesOrderPdfService } from './sales-order-pdf.service';
import { InvoiceService } from '../invoice/invoice.service';
import { EmailService } from '../shared/services/email.service';
import { CreateSalesOrderDto, UpdateSalesOrderDto, SendSalesOrderEmailDto } from './dto/sales-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sales-orders')
@UseGuards(JwtAuthGuard)
export class SalesOrderController {
  constructor(
    private readonly salesOrderService: SalesOrderService,
    private readonly salesOrderPdfService: SalesOrderPdfService,
    private readonly invoiceService: InvoiceService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  create(@Body() createSalesOrderDto: CreateSalesOrderDto, @Request() req) {
    return this.salesOrderService.create(req.user.businessId, createSalesOrderDto, req.user.id, req.user.email);
  }

  @Get()
  findAll(@Request() req) {
    return this.salesOrderService.findAll(req.user.businessId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.salesOrderService.findOne(id, req.user.businessId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSalesOrderDto: UpdateSalesOrderDto, @Request() req) {
    return this.salesOrderService.update(id, req.user.businessId, updateSalesOrderDto, req.user.id, req.user.email);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req) {
    return this.salesOrderService.remove(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @Request() req) {
    return this.salesOrderService.confirm(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Patch(':id/deliver')
  deliver(@Param('id') id: string, @Request() req) {
    return this.salesOrderService.deliver(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req) {
    return this.salesOrderService.cancel(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Request() req) {
    return this.salesOrderService.duplicate(id, req.user.businessId, req.user.id, req.user.email);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Request() req, @Res() res: ExpressResponse) {
    const salesOrder = await this.salesOrderService.findOne(id, req.user.businessId);
    const pdfBuffer = await this.salesOrderPdfService.generateSalesOrderPdf(salesOrder);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sales-order-${salesOrder.salesOrderNumber}.pdf"`);
    res.send(pdfBuffer);
  }

  @Post(':id/send-email')
  @HttpCode(HttpStatus.OK)
  async sendEmail(@Param('id') id: string, @Body() sendDto: SendSalesOrderEmailDto, @Request() req) {
    const salesOrder = await this.salesOrderService.findOne(id, req.user.businessId);
    
    let recipientEmail = sendDto.email || salesOrder.client?.email;
    
    if (!recipientEmail) {
      throw new BadRequestException('Client has no email. Please provide one.');
    }
    
    // Generate PDF and send email
    const pdfBuffer = await this.salesOrderPdfService.generateSalesOrderPdf(salesOrder);
    await this.emailService.sendSalesOrderEmail(recipientEmail, salesOrder, pdfBuffer, sendDto.subject, sendDto.message);
    
    return { 
      message: `Sales order sent successfully to ${recipientEmail}`,
      recipient: recipientEmail
    };
  }

  @Post(':id/convert-to-invoice')
  async convertToInvoice(@Param('id') id: string, @Request() req) {
    return this.salesOrderService.convertToInvoice(
      id, 
      req.user.businessId, 
      this.invoiceService, 
      req.user.id, 
      req.user.email
    );
  }
}
