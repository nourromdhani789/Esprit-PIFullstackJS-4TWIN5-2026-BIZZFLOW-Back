import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Invoice } from '../entities/invoice.entity';
import { Quote } from '../../quote/entities/quote.entity';
import { SalesOrder } from '../../sales-order/entities/sales-order.entity';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendInvoiceEmail(
    to: string,
    invoice: Invoice,
    pdfBuffer: Buffer,
    subject?: string,
    message?: string,
  ): Promise<void> {
    const emailSubject = subject || `Invoice #${invoice.invoiceNumber} from ${invoice.business?.name || 'Your Business'}`;
    const emailMessage = message || `Please find attached invoice #${invoice.invoiceNumber}.`;

    await this.transporter.sendMail({
      from: `"${invoice.business?.name || 'Your Business'}" <${this.configService.get('SMTP_USER')}>`,
      to,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #465fff;">${emailSubject}</h2>
          <p>${emailMessage}</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Invoice Number:</strong> #${invoice.invoiceNumber}</p>
            <p><strong>Amount Due:</strong> $${invoice.totalAmount.toFixed(2)}</p>
            <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
            ${invoice.dueDate ? `<p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>` : ''}
          </div>
          <p style="color: #666; font-size: 14px;">Please find the detailed invoice attached to this email.</p>
        </div>
      `,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  async sendQuoteEmail(
    to: string,
    quote: Quote,
    pdfBuffer: Buffer,
    subject?: string,
    message?: string,
  ): Promise<void> {
    const emailSubject = subject || `Quote #${quote.quoteNumber} from ${quote.business?.name || 'Your Business'}`;
    const emailMessage = message || `Please find attached quote #${quote.quoteNumber}.`;

    await this.transporter.sendMail({
      from: `"${quote.business?.name || 'Your Business'}" <${this.configService.get('SMTP_USER')}>`,
      to,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #465fff;">${emailSubject}</h2>
          <p>${emailMessage}</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Quote Number:</strong> #${quote.quoteNumber}</p>
            <p><strong>Total Amount:</strong> $${Number(quote.totalAmount).toFixed(2)}</p>
            <p><strong>Status:</strong> ${quote.status.toUpperCase()}</p>
            ${quote.expiryDate ? `<p><strong>Valid Until:</strong> ${new Date(quote.expiryDate).toLocaleDateString()}</p>` : ''}
          </div>
          <p style="color: #666; font-size: 14px;">Please find the detailed quote attached to this email.</p>
        </div>
      `,
      attachments: [
        {
          filename: `quote-${quote.quoteNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  async sendSalesOrderEmail(
    to: string,
    salesOrder: SalesOrder,
    pdfBuffer: Buffer,
    subject?: string,
    message?: string,
  ): Promise<void> {
    const emailSubject = subject || `Sales Order #${salesOrder.salesOrderNumber} from ${salesOrder.business?.name || 'Your Business'}`;
    const emailMessage = message || `Please find attached sales order #${salesOrder.salesOrderNumber}.`;

    await this.transporter.sendMail({
      from: `"${salesOrder.business?.name || 'Your Business'}" <${this.configService.get('SMTP_USER')}>`,
      to,
      subject: emailSubject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #465fff;">${emailSubject}</h2>
          <p>${emailMessage}</p>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Sales Order Number:</strong> #${salesOrder.salesOrderNumber}</p>
            <p><strong>Total Amount:</strong> $${Number(salesOrder.totalAmount).toFixed(2)}</p>
            <p><strong>Status:</strong> ${salesOrder.status.toUpperCase()}</p>
            ${salesOrder.expectedDeliveryDate ? `<p><strong>Expected Delivery:</strong> ${new Date(salesOrder.expectedDeliveryDate).toLocaleDateString()}</p>` : ''}
          </div>
          <p style="color: #666; font-size: 14px;">Please find the detailed sales order attached to this email.</p>
        </div>
      `,
      attachments: [
        {
          filename: `sales-order-${salesOrder.salesOrderNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
