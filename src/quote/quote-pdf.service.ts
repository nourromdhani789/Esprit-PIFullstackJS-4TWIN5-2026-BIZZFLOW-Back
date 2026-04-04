import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { Quote } from './entities/quote.entity';

@Injectable()
export class QuotePdfService {
  async generateQuotePdf(quote: Quote): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Generate HTML content for the quote
    const htmlContent = this.generateQuoteHtml(quote);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  private generateQuoteHtml(quote: Quote): string {
    const items = quote.items?.map(item => {
      const unitPrice = Number(item.unitPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      const total = unitPrice * quantity;
      return `
      <tr>
        <td>${item.product?.name || 'Product'}</td>
        <td>${item.description || '-'}</td>
        <td>${quantity}</td>
        <td>$${unitPrice.toFixed(2)}</td>
        <td>$${total.toFixed(2)}</td>
      </tr>
    `}).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; }
          .quote-title { font-size: 24px; font-weight: bold; color: #2563eb; }
          .quote-number { font-size: 14px; color: #666; margin-top: 5px; }
          .section { margin-bottom: 20px; }
          .section-title { font-weight: bold; margin-bottom: 8px; color: #111; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .totals { margin-top: 20px; text-align: right; }
          .total-row { margin-bottom: 5px; }
          .grand-total { font-weight: bold; font-size: 16px; color: #2563eb; }
          .status { display: inline-block; padding: 5px 12px; border-radius: 12px; font-size: 12px; text-transform: uppercase; }
          .status-draft { background: #f3f4f6; color: #666; }
          .status-sent { background: #dbeafe; color: #2563eb; }
          .status-accepted { background: #d1fae5; color: #059669; }
          .status-rejected { background: #fee2e2; color: #dc2626; }
          .notes { margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="quote-title">QUOTE</div>
          <div class="quote-number">${quote.quoteNumber}</div>
          <div class="status status-${quote.status}">${quote.status}</div>
        </div>

        <div class="section">
          <div class="section-title">Client Information</div>
          <div><strong>${quote.client?.name || 'N/A'}</strong></div>
          <div>${quote.client?.email || ''}</div>
          <div>${quote.client?.phone || ''}</div>
          <div>${quote.client?.address || ''}</div>
        </div>

        <div class="section">
          <div class="info-row">
            <span><strong>Issue Date:</strong> ${new Date(quote.issueDate).toLocaleDateString()}</span>
            <span><strong>Expiry Date:</strong> ${new Date(quote.expiryDate).toLocaleDateString()}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">Subtotal: $${(Number(quote.subtotal) || 0).toFixed(2)}</div>
          <div class="total-row">Tax (${quote.taxRate || 0}%): $${(Number(quote.taxAmount) || 0).toFixed(2)}</div>
          <div class="grand-total">Total: $${(Number(quote.totalAmount) || 0).toFixed(2)}</div>
        </div>

        ${quote.notes ? `
        <div class="notes">
          <div class="section-title">Notes</div>
          <div>${quote.notes}</div>
        </div>
        ` : ''}
      </body>
      </html>
    `;
  }
}
