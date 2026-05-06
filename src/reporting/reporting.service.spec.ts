import { Test, TestingModule } from '@nestjs/testing';
import { ReportingService } from './reporting.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity';
import { Expense } from '../expense/entities/expense.entity';
import { Product } from '../product/entities/product.entity';
import { Client } from '../client/entities/client.entity';

describe('ReportingService', () => {
  let service: ReportingService;

  const invoiceQb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getRawOne: jest.fn(),
  };
  const expenseQb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockInvoiceRepo = {
    count: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => invoiceQb),
  };
  const mockExpenseRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => expenseQb),
  };
  const mockProductRepo = { count: jest.fn() };
  const mockClientRepo = { count: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(Expense), useValue: mockExpenseRepo },
        { provide: getRepositoryToken(Product), useValue: mockProductRepo },
        { provide: getRepositoryToken(Client), useValue: mockClientRepo },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
    jest.clearAllMocks();
  });

  describe('getKPIs', () => {
    it('should return KPI data', async () => {
      invoiceQb.getMany.mockResolvedValue([{ totalAmount: 1000 }, { totalAmount: 500 }]);
      expenseQb.getMany.mockResolvedValue([{ amount: 300 }]);
      mockProductRepo.count.mockResolvedValue(50);
      mockClientRepo.count.mockResolvedValue(20);
      mockInvoiceRepo.count.mockResolvedValue(10);

      const result = await service.getKPIs('biz-1');
      expect(result.totalRevenue).toBe(1500);
      expect(result.totalExpenses).toBe(300);
      expect(result.profit).toBe(1200);
      expect(result.profitMargin).toBe(80);
      expect(result.totalProducts).toBe(50);
      expect(result.totalClients).toBe(20);
      expect(result.totalInvoices).toBe(10);
    });

    it('should handle zero revenue for profit margin', async () => {
      invoiceQb.getMany.mockResolvedValue([]);
      expenseQb.getMany.mockResolvedValue([]);
      mockProductRepo.count.mockResolvedValue(0);
      mockClientRepo.count.mockResolvedValue(0);
      mockInvoiceRepo.count.mockResolvedValue(0);

      const result = await service.getKPIs('biz-1');
      expect(result.profitMargin).toBe(0);
    });
  });

  describe('getMonthlyTrend', () => {
    it('should return monthly trend data', async () => {
      mockInvoiceRepo.find.mockResolvedValue([{ totalAmount: 500 }]);
      mockExpenseRepo.find.mockResolvedValue([{ amount: 200 }]);

      const result = await service.getMonthlyTrend('biz-1', 3);
      expect(result.length).toBe(3);
      expect(result[0].revenue).toBe(500);
      expect(result[0].expenses).toBe(200);
      expect(result[0].profit).toBe(300);
    });
  });

  describe('getTopClients', () => {
    it('should return top clients sorted by total invoiced', async () => {
      mockInvoiceRepo.find.mockResolvedValue([
        { clientId: 'c1', client: { name: 'Client1' }, totalAmount: 1000, status: InvoiceStatus.PAID },
        { clientId: 'c2', client: { name: 'Client2' }, totalAmount: 500, status: InvoiceStatus.UNPAID },
      ]);

      const result = await service.getTopClients('biz-1', 5);
      expect(result.length).toBe(2);
      expect(result[0].clientName).toBe('Client1');
      expect(result[0].totalInvoiced).toBe(1000);
      expect(result[0].totalPaid).toBe(1000);
      expect(result[1].totalPaid).toBe(0);
    });

    it('should handle invoices without client', async () => {
      mockInvoiceRepo.find.mockResolvedValue([
        { clientId: 'c1', client: null, totalAmount: 500, status: InvoiceStatus.PAID },
      ]);

      const result = await service.getTopClients('biz-1', 5);
      expect(result[0].clientName).toBe('Unknown');
    });
  });

  describe('getDashboardData', () => {
    it('should return complete dashboard data', async () => {
      invoiceQb.getMany.mockResolvedValue([{ totalAmount: 1000 }]);
      expenseQb.getMany.mockResolvedValue([{ amount: 200 }]);
      mockProductRepo.count.mockResolvedValue(10);
      mockClientRepo.count.mockResolvedValue(5);
      mockInvoiceRepo.count.mockResolvedValue(8);
      mockInvoiceRepo.find.mockResolvedValue([{ id: 'inv-1' }]);
      mockExpenseRepo.find.mockResolvedValue([{ id: 'exp-1' }]);

      const result = await service.getDashboardData('biz-1');
      expect(result.kpis).toBeDefined();
      expect(result.monthlyTrend).toBeDefined();
      expect(result.topClients).toBeDefined();
      expect(result.recentInvoices).toBeDefined();
      expect(result.recentExpenses).toBeDefined();
    });
  });

  describe('getReportData', () => {
    it('should return report data with date filters', async () => {
      invoiceQb.getMany.mockResolvedValue([
        { totalAmount: 1000, status: InvoiceStatus.PAID },
        { totalAmount: 500, status: InvoiceStatus.UNPAID },
      ]);
      expenseQb.getMany.mockResolvedValue([{ amount: 200 }]);

      const result = await service.getReportData('biz-1', { startDate: new Date(), endDate: new Date() });
      expect(result.summary.totalRevenue).toBe(1000);
      expect(result.summary.totalExpenses).toBe(200);
      expect(result.summary.profit).toBe(800);
    });
  });
});
