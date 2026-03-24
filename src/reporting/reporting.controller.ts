import { Controller, Get, Query, UseGuards, Request, Res } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { ReportingService, ReportFilters } from './reporting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reporting')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

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
    const filters: ReportFilters = {};
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    const reportData = await this.reportingService.getReportData(req.user.businessId, filters);
    
    // Generate CSV content
    let csv = 'Financial Report\n\n';
    csv += `Period,${startDate || 'All time'} to ${endDate || 'Now'}\n\n`;
    
    csv += 'Summary\n';
    csv += 'Metric,Value\n';
    csv += `Total Revenue,$${reportData.summary.totalRevenue.toFixed(2)}\n`;
    csv += `Total Expenses,$${reportData.summary.totalExpenses.toFixed(2)}\n`;
    csv += `Profit,$${reportData.summary.profit.toFixed(2)}\n`;
    csv += `Total Invoices,${reportData.summary.totalInvoices}\n`;
    csv += `Total Expenses,${reportData.summary.totalExpensesCount}\n\n`;
    
    csv += 'Invoices\n';
    csv += 'Invoice Number,Client,Date,Status,Amount\n';
    reportData.invoices.forEach((inv) => {
      csv += `${inv.invoiceNumber || 'N/A'},${inv.clientName || inv.clientId},${inv.createdAt.toISOString().split('T')[0]},${inv.status},$${inv.totalAmount}\n`;
    });
    csv += '\n';
    
    csv += 'Expenses\n';
    csv += 'Date,Category,Supplier,Amount,Status\n';
    reportData.expenses.forEach((exp) => {
      csv += `${exp.date.toISOString().split('T')[0]},${exp.category},${exp.supplier || 'N/A'},$${exp.amount},${exp.status}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
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
    
    // Generate simple HTML for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Financial Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #333; }
          h2 { color: #555; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .summary { background: #f9f9f9; padding: 15px; margin: 20px 0; }
          .amount { text-align: right; }
          .positive { color: green; }
          .negative { color: red; }
        </style>
      </head>
      <body>
        <h1>Financial Report</h1>
        <p>Period: ${startDate || 'All time'} to ${endDate || 'Now'}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <div class="summary">
          <h2>Summary</h2>
          <table>
            <tr><td>Total Revenue</td><td class="amount">$${reportData.summary.totalRevenue.toFixed(2)}</td></tr>
            <tr><td>Total Expenses</td><td class="amount">$${reportData.summary.totalExpenses.toFixed(2)}</td></tr>
            <tr><td><strong>Profit</strong></td><td class="amount ${reportData.summary.profit >= 0 ? 'positive' : 'negative'}"><strong>$${reportData.summary.profit.toFixed(2)}</strong></td></tr>
            <tr><td>Total Invoices</td><td>${reportData.summary.totalInvoices}</td></tr>
            <tr><td>Total Expenses</td><td>${reportData.summary.totalExpensesCount}</td></tr>
          </table>
        </div>
        
        <h2>Invoices (${reportData.invoices.length})</h2>
        <table>
          <tr>
            <th>Invoice #</th>
            <th>Client</th>
            <th>Date</th>
            <th>Status</th>
            <th class="amount">Amount</th>
          </tr>
          ${reportData.invoices.map(inv => `
            <tr>
              <td>${inv.invoiceNumber || 'N/A'}</td>
              <td>${inv.clientName || inv.clientId}</td>
              <td>${inv.createdAt.toISOString().split('T')[0]}</td>
              <td>${inv.status}</td>
              <td class="amount">$${Number(inv.totalAmount).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Expenses (${reportData.expenses.length})</h2>
        <table>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Supplier</th>
            <th>Status</th>
            <th class="amount">Amount</th>
          </tr>
          ${reportData.expenses.map(exp => `
            <tr>
              <td>${exp.date.toISOString().split('T')[0]}</td>
              <td>${exp.category}</td>
              <td>${exp.supplier || 'N/A'}</td>
              <td>${exp.status}</td>
              <td class="amount">$${Number(exp.amount).toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="financial-report-${new Date().toISOString().split('T')[0]}.html"`);
    res.send(html);
  }
}
