import { Controller, Get, Query, UseGuards, Request, Res } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import puppeteer from 'puppeteer';
import { ReportingService, ReportFilters } from './reporting.service';
import { BusinessService } from '../business/business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reporting')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly businessService: BusinessService,
  ) {}

  private formatReportDate(value: any): string {
    if (value == null) return '';

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
    }

    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      if (date instanceof Date && !isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    if (typeof value.toISOString === 'function') {
      try {
        return value.toISOString().split('T')[0];
      } catch {
        return '';
      }
    }

    if (typeof value.toString === 'function') {
      const parsed = new Date(value.toString());
      return isNaN(parsed.getTime()) ? '' : parsed.toISOString().split('T')[0];
    }

    return '';
  }

  private formatMoney(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  }

  private async resolveBusinessCurrency(businessId: string): Promise<string> {
    try {
      const business = await this.businessService.findOne(businessId);
      return business.currency || 'USD';
    } catch {
      return 'USD';
    }
  }

  @Get('dashboard')
  async getDashboard(@Request() req) {
    return this.reportingService.getDashboardData(req.user.businessId);
  }

  @Get('kpis')
  async getKPIs(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: ReportFilters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    return this.reportingService.getKPIs(req.user.businessId, filters);
  }

  @Get('monthly-trend')
  async getMonthlyTrend(
    @Request() req,
    @Query('months') months?: string,
  ) {
    const monthCount = months ? parseInt(months, 10) : 6;
    return this.reportingService.getMonthlyTrend(req.user.businessId, monthCount);
  }

  @Get('report')
  async getFullReport(
    @Request() req,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: ReportFilters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    return this.reportingService.getReportData(req.user.businessId, filters);
  }

  @Get('export/csv')
  async exportCSV(
    @Request() req,
    @Res() res: ExpressResponse,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const filters: ReportFilters = {};
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);
      
      const reportData = await this.reportingService.getReportData(req.user.businessId, filters);
      const currency = await this.resolveBusinessCurrency(req.user.businessId);
      
      const invoiceRows = reportData.invoices.map((inv) => {
        const invoiceDate = this.formatReportDate(inv.createdAt);
        return `${inv.invoiceNumber || 'N/A'},${inv.client?.name || inv.clientId},${invoiceDate},${inv.status},${this.formatMoney(Number(inv.totalAmount), currency)}`;
      }).join('\n');
      
      const expenseRows = reportData.expenses.map((exp) => {
        const expenseDate = this.formatReportDate(exp.date);
        return `${expenseDate},${exp.category},${exp.supplier || 'N/A'},${this.formatMoney(Number(exp.amount), currency)},${exp.status}`;
      }).join('\n');
      
      let csv = 'Financial Report\n\n';
      csv += `Period,${startDate || 'All time'} to ${endDate || 'Now'}\n`;
      csv += `Currency,${currency}\n\n`;
      csv += 'Summary\n';
      csv += 'Metric,Value\n';
      csv += `Total Revenue,${this.formatMoney(reportData.summary.totalRevenue, currency)}\n`;
      csv += `Total Expenses,${this.formatMoney(reportData.summary.totalExpenses, currency)}\n`;
      csv += `Profit,${this.formatMoney(reportData.summary.profit, currency)}\n`;
      csv += `Total Invoices,${reportData.summary.totalInvoices}\n`;
      csv += `Total Expenses,${reportData.summary.totalExpensesCount}\n\n`;
      csv += 'Invoices\n';
      csv += 'Invoice Number,Client,Date,Status,Amount\n';
      csv += invoiceRows;
      csv += '\n\n';
      csv += 'Expenses\n';
      csv += 'Date,Category,Supplier,Amount,Status\n';
      csv += expenseRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error('Export CSV error:', error);
      throw error;
    }
  }

  @Get('export/pdf')
  async exportPDF(
    @Request() req,
    @Res() res: ExpressResponse,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: ReportFilters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    const reportData = await this.reportingService.getReportData(req.user.businessId, filters);
    const currency = await this.resolveBusinessCurrency(req.user.businessId);
    
    const invoiceRows = reportData.invoices.map(inv => {
      const invoiceDate = this.formatReportDate(inv.createdAt);
      return `
            <tr>
              <td>${inv.invoiceNumber || 'N/A'}</td>
              <td>${inv.client?.name || inv.clientId}</td>
              <td>${invoiceDate}</td>
              <td>${inv.status}</td>
              <td class="amount">${this.formatMoney(Number(inv.totalAmount), currency)}</td>
            </tr>`;
    }).join('');

    const expenseRows = reportData.expenses.map(exp => {
      const expenseDate = this.formatReportDate(exp.date);
      return `
            <tr>
              <td>${expenseDate}</td>
              <td>${exp.category}</td>
              <td>${exp.supplier || 'N/A'}</td>
              <td>${exp.status}</td>
              <td class="amount">${this.formatMoney(Number(exp.amount), currency)}</td>
            </tr>`;
    }).join('');

    // Generate enhanced HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Financial Report</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f4f7fb;
            --surface: #ffffff;
            --surface-muted: #f9fafc;
            --text: #111827;
            --text-muted: #4b5563;
            --primary: #2563eb;
            --primary-soft: #e0e7ff;
            --success: #16a34a;
            --danger: #dc2626;
            --border: #e5e7eb;
          }

          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }
          .page { width: 100%; max-width: 960px; margin: 0 auto; padding: 40px; background: var(--surface); border-radius: 24px; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.08); }
          header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 30px; }
          .brand { display: flex; flex-direction: column; gap: 8px; }
          .brand h1 { margin: 0; font-size: 32px; letter-spacing: -0.03em; }
          .brand p { margin: 0; color: var(--text-muted); font-size: 0.95rem; }
          .meta { text-align: right; min-width: 180px; }
          .meta .tag { display: inline-flex; align-items: center; gap: 8px; background: var(--primary-soft); color: var(--primary); padding: 8px 12px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
          .meta p { margin: 8px 0 0; color: var(--text-muted); font-size: 0.93rem; }
          .section-title { margin: 0 0 18px; font-size: 20px; color: #1f2937; }
          .report-info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
          .report-card { background: var(--surface-muted); border: 1px solid var(--border); border-radius: 18px; padding: 18px 20px; }
          .report-card strong { display: block; font-size: 0.98rem; color: var(--text); margin-bottom: 6px; }
          .report-card span { color: var(--text-muted); font-size: 0.92rem; }
          .stats-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; }
          .card { padding: 22px; border-radius: 18px; background: var(--surface-muted); border: 1px solid var(--border); }
          .card-title { font-size: 0.95rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
          .card-value { font-size: 1.5rem; font-weight: 700; color: var(--text); line-height: 1.1; }
          .card-value.positive { color: var(--success); }
          .card-value.negative { color: var(--danger); }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
          th, td { padding: 14px 18px; }
          thead th { background: #eef2ff; color: #1e3a8a; text-align: left; font-size: 0.95rem; font-weight: 700; }
          tbody tr { border-bottom: 1px solid #e5e7eb; }
          tbody tr:last-child { border-bottom: none; }
          tbody tr:nth-child(even) { background: #f8fafc; }
          tbody tr:hover { background: #eff6ff; }
          td { color: var(--text); font-size: 0.92rem; }
          td.amount { text-align: right; font-feature-settings: 'tnum'; }
          .summary-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 32px; }
          .summary-card { padding: 20px; border-radius: 18px; background: #ffffff; border: 1px solid var(--border); box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06); }
          .summary-card strong { display: block; font-size: 0.9rem; margin-bottom: 10px; color: var(--text-muted); }
          .summary-card span { font-size: 1.45rem; font-weight: 700; color: var(--text); }
          .summary-card span.positive { color: var(--success); }
          .summary-card span.negative { color: var(--danger); }
          .footer { margin-top: 24px; font-size: 0.88rem; color: var(--text-muted); text-align: center; }
        </style>
      </head>
      <body>
        <div class="page">
          <header>
            <div class="brand">
              <h1>Financial Report</h1>
              <p>Business: ${req.user.businessId}</p>
            </div>
            <div class="meta">
              <span class="tag">${currency} Report</span>
              <p>Period: ${startDate || 'All time'} to ${endDate || 'Now'}</p>
              <p>Generated: ${new Date().toLocaleString()}</p>
            </div>
          </header>

          <section class="summary-cards">
            <div class="summary-card">
              <strong>Total Revenue</strong>
              <span>${this.formatMoney(reportData.summary.totalRevenue, currency)}</span>
            </div>
            <div class="summary-card">
              <strong>Total Expenses</strong>
              <span>${this.formatMoney(reportData.summary.totalExpenses, currency)}</span>
            </div>
            <div class="summary-card">
              <strong>Profit</strong>
              <span class="${reportData.summary.profit >= 0 ? 'positive' : 'negative'}">${this.formatMoney(reportData.summary.profit, currency)}</span>
            </div>
          </section>

          <section>
            <h2 class="section-title">Invoices (${reportData.invoices.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th class="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRows}
              </tbody>
            </table>
          </section>

          <section>
            <h2 class="section-title">Expenses (${reportData.expenses.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th class="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${expenseRows}
              </tbody>
            </table>
          </section>

          <div class="footer">Generated by your financial dashboard • ${new Date().toLocaleDateString()}</div>
        </div>
      </body>
      </html>
    `;
    
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
      });
      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="financial-report-${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export PDF error:', error);
      await res.status(500).send('Failed to generate PDF');
    }
  }
}
