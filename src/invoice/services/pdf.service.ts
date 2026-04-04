import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class PdfService {
  async generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const html = this.getInvoiceHtml(invoice);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  private getInvoiceHtml(invoice: Invoice): string {
    const items = invoice.items || [];
    const itemsHtml = items.map(item => `
      <tr>
        <td>${item.description || item.product?.name || 'Product'}</td>
        <td style="text-align: center;">${item.quantity}</td>
        <td style="text-align: right;">${Number(item.price).toFixed(2)}</td>
        <td style="text-align: right;">${Number(item.total).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .invoice-title { font-size: 32px; color: #465fff; margin: 0; }
          .invoice-details { text-align: right; }
          .invoice-number { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .invoice-date { color: #666; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 14px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
          .business-name { font-size: 20px; font-weight: bold; }
          .client-name { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f5f5f5; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          .totals { margin-top: 30px; text-align: right; }
          .totals-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
          .totals-label { width: 150px; text-align: right; margin-right: 20px; }
          .totals-value { width: 100px; }
          .total-amount { font-size: 20px; font-weight: bold; color: #465fff; }
          .status { 
            display: inline-block; 
            padding: 6px 16px; 
            border-radius: 20px; 
            font-size: 14px; 
            font-weight: 600;
            text-transform: uppercase;
          }
          .status-paid { background: #d1fadf; color: #027a48; }
          .status-unpaid { background: #fee4e2; color: #b42318; }
          .status-overdue { background: #fef0c7; color: #b54708; }
          .notes { margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="invoice-title">INVOICE</h1>
            <div class="section" style="margin-top: 20px;">
              <div class="section-title">From</div>
              <div class="business-name">${invoice.business?.name || 'Business'}</div>
              ${invoice.business?.address ? `<div>${invoice.business.address}</div>` : ''}
              ${invoice.business?.phone ? `<div>${invoice.business.phone}</div>` : ''}
            </div>
          </div>
          <div class="invoice-details">
            <div class="invoice-number">#${invoice.invoiceNumber}</div>
            <div class="invoice-date">${new Date(invoice.createdAt).toLocaleDateString()}</div>
            <div style="margin-top: 15px;">
              <span class="status status-${invoice.status}">${invoice.status}</span>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Bill To</div>
          <div class="client-name">${invoice.client?.name || 'Client'}</div>
          ${invoice.client?.email ? `<div>${invoice.client.email}</div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span class="totals-label">Subtotal:</span>
            <span class="totals-value">$${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          ${invoice.taxAmount > 0 ? `
          <div class="totals-row">
            <span class="totals-label">Tax:</span>
            <span class="totals-value">$${Number(invoice.taxAmount).toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="totals-row total-amount">
            <span class="totals-label">Total:</span>
            <span class="totals-value">$${Number(invoice.totalAmount).toFixed(2)}</span>
          </div>
        </div>

        ${invoice.notes ? `
        <div class="notes">
          <div class="section-title">Notes</div>
          <div>${invoice.notes}</div>
        </div>
        ` : ''}

        ${invoice.dueDate ? `
        <div style="margin-top: 20px; text-align: center; color: #666;">
          Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
        </div>
        ` : ''}
      </body>
      </html>
    `;
  }
}
