import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity';
import { Expense } from '../expense/entities/expense.entity';

export interface KPIData {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface DashboardData {
  kpis: KPIData;
  monthlyTrend: MonthlyData[];
  recentInvoices: Invoice[];
  recentExpenses: Expense[];
}

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  async getKPIs(businessId: string, filters?: ReportFilters): Promise<KPIData> {
    const { startDate, endDate } = filters || {};

    // Calculate total revenue from PAID invoices
    const invoiceQuery = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.businessId = :businessId', { businessId })
      .andWhere('invoice.status = :status', { status: InvoiceStatus.PAID });

    if (startDate && endDate) {
      invoiceQuery.andWhere({
        createdAt: Between(startDate, endDate),
      });
    }

    const invoices = await invoiceQuery.getMany();
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

    // Calculate total expenses from APPROVED expenses
    const expenseQuery = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.businessId = :businessId', { businessId })
      .andWhere('expense.status = :status', { status: 'approved' });

    if (startDate && endDate) {
      expenseQuery.andWhere({
        date: Between(startDate, endDate),
      });
    }

    const expenses = await expenseQuery.getMany();
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    const profit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      profit,
      profitMargin: parseFloat(profitMargin.toFixed(2)),
    };
  }

  async getMonthlyTrend(businessId: string, months: number = 6): Promise<MonthlyData[]> {
    const result: MonthlyData[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();
      const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });

      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      // Revenue for this month
      const invoices = await this.invoiceRepository.find({
        where: {
          businessId,
          status: InvoiceStatus.PAID,
          createdAt: Between(startOfMonth, endOfMonth),
        },
      });
      const revenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

      // Expenses for this month
      const expenses = await this.expenseRepository.find({
        where: {
          businessId,
          status: 'approved',
          date: Between(startOfMonth, endOfMonth),
        },
      });
      const expenseTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      result.push({
        month: monthName,
        revenue,
        expenses: expenseTotal,
        profit: revenue - expenseTotal,
      });
    }

    return result;
  }

  async getDashboardData(businessId: string): Promise<DashboardData> {
    const [kpis, monthlyTrend] = await Promise.all([
      this.getKPIs(businessId),
      this.getMonthlyTrend(businessId, 6),
    ]);

    // Get recent invoices (last 5)
    const recentInvoices = await this.invoiceRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    // Get recent expenses (last 5)
    const recentExpenses = await this.expenseRepository.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return {
      kpis,
      monthlyTrend,
      recentInvoices,
      recentExpenses,
    };
  }

  async getReportData(businessId: string, filters?: ReportFilters) {
    const { startDate, endDate } = filters || {};

    // Get all paid invoices in range
    const invoiceQuery = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .where('invoice.businessId = :businessId', { businessId });

    if (startDate && endDate) {
      invoiceQuery.andWhere({
        createdAt: Between(startDate, endDate),
      });
    }

    const invoices = await invoiceQuery.getMany();

    // Get all approved expenses in range
    const expenseQuery = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.businessId = :businessId', { businessId })
      .andWhere('expense.status = :status', { status: 'approved' });

    if (startDate && endDate) {
      expenseQuery.andWhere({
        date: Between(startDate, endDate),
      });
    }

    const expenses = await expenseQuery.getMany();

    const totalRevenue = invoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    return {
      summary: {
        totalRevenue,
        totalExpenses,
        profit: totalRevenue - totalExpenses,
        totalInvoices: invoices.length,
        totalExpensesCount: expenses.length,
      },
      invoices,
      expenses,
    };
  }
}
