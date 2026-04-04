import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { SalesOrder } from './entities/sales-order.entity';

@Injectable()
export class SalesOrderPdfService {
  async generateSalesOrderPdf(salesOrder: SalesOrder): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const htmlContent = this.generateSalesOrderHtml(salesOrder);
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  private generateSalesOrderHtml(salesOrder: SalesOrder): string {
    const items = salesOrder.items?.map(item => {
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
          .so-title { font-size: 24px; font-weight: bold; color: #2563eb; }
          .so-number { font-size: 14px; color: #666; margin-top: 5px; }
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
          .status-confirmed { background: #dbeafe; color: #2563eb; }
          .status-shipped { background: #fef3c7; color: #d97706; }
          .status-delivered { background: #d1fae5; color: #059669; }
          .status-cancelled { background: #fee2e2; color: #dc2626; }
          .notes { margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="so-title">SALES ORDER</div>
          <div class="so-number">${salesOrder.salesOrderNumber}</div>
          <div class="status status-${salesOrder.status}">${salesOrder.status}</div>
        </div>

        <div class="section">
          <div class="section-title">Client Information</div>
          <div><strong>${salesOrder.client?.name || 'N/A'}</strong></div>
          <div>${salesOrder.client?.email || ''}</div>
          <div>${salesOrder.client?.phone || ''}</div>
          <div>${salesOrder.client?.address || ''}</div>
        </div>

        <div class="section">
          <div class="info-row">
            <span><strong>Issue Date:</strong> ${new Date(salesOrder.issueDate).toLocaleDateString()}</span>
            ${salesOrder.expectedDeliveryDate ? `<span><strong>Expected Delivery:</strong> ${new Date(salesOrder.expectedDeliveryDate).toLocaleDateString()}</span>` : ''}
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
          <div class="total-row">Subtotal: $${(Number(salesOrder.subtotal) || 0).toFixed(2)}</div>
          <div class="total-row">Tax (${salesOrder.taxRate || 0}%): $${(Number(salesOrder.taxAmount) || 0).toFixed(2)}</div>
          <div class="grand-total">Total: $${(Number(salesOrder.totalAmount) || 0).toFixed(2)}</div>
        </div>

        ${salesOrder.notes ? `
        <div class="notes">
          <div class="section-title">Notes</div>
          <div>${salesOrder.notes}</div>
        </div>
        ` : ''}
      </body>
      </html>
    `;
  }
}
