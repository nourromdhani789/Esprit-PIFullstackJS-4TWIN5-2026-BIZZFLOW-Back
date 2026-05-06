import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardService } from './admin-dashboard.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { ActivityLogService } from '../activity/activity-log.service';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  const userQb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const businessQb: any = {
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };
  const invoiceQb: any = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };

  const mockUserRepo = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => userQb),
  };
  const mockBusinessRepo = {
    count: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => businessQb),
  };
  const mockInvoiceRepo = {
    count: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => invoiceQb),
  };
  const mockTenantRepo = { count: jest.fn() };
  const mockActivityLogService = {
    getPlatformActivityLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Business), useValue: mockBusinessRepo },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(Tenant), useValue: mockTenantRepo },
        { provide: ActivityLogService, useValue: mockActivityLogService },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
    jest.clearAllMocks();
  });

  describe('getDashboardMetrics', () => {
    it('should return dashboard metrics', async () => {
      mockUserRepo.count.mockResolvedValue(100);
      mockBusinessRepo.count.mockResolvedValue(10);
      mockInvoiceRepo.count.mockResolvedValue(50);
      invoiceQb.getRawOne.mockResolvedValue({ total: '5000' });

      const result = await service.getDashboardMetrics();
      expect(result.totalUsers).toBe(100);
      expect(result.totalBusinesses).toBe(10);
      expect(result.totalInvoices).toBe(50);
      expect(result.totalRevenue).toBe(5000);
    });
  });

  describe('getRecentUsers', () => {
    it('should return recent users', async () => {
      const users = [{
        id: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com',
        roleId: 'admin', isActive: true, createdAt: new Date(),
      }];
      mockUserRepo.find.mockResolvedValue(users);

      const result = await service.getRecentUsers(5);
      expect(result.length).toBe(1);
      expect(result[0].email).toBe('john@test.com');
    });
  });

  describe('getRecentBusinesses', () => {
    it('should return recent businesses', async () => {
      const businesses = [{
        id: '1', name: 'Biz1', legalName: 'Biz1 LLC', tenantId: 't1',
        createdAt: new Date(),
        tenant: { user: { firstName: 'John', lastName: 'Doe', email: 'john@test.com' } },
      }];
      mockBusinessRepo.find.mockResolvedValue(businesses);

      const result = await service.getRecentBusinesses(5);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Biz1');
      expect(result[0].ownerEmail).toBe('john@test.com');
    });

    it('should handle business without tenant user', async () => {
      const businesses = [{
        id: '1', name: 'Biz1', legalName: null, tenantId: 't1',
        createdAt: new Date(), tenant: null,
      }];
      mockBusinessRepo.find.mockResolvedValue(businesses);

      const result = await service.getRecentBusinesses(5);
      expect(result[0].ownerEmail).toBe('N/A');
    });
  });

  describe('getUserGrowthData', () => {
    it('should return user growth data', async () => {
      mockUserRepo.count.mockResolvedValue(5);
      const result = await service.getUserGrowthData(3);
      expect(result.length).toBe(3);
      expect(result[0].count).toBe(5);
    });
  });

  describe('getRevenueData', () => {
    it('should return revenue data', async () => {
      invoiceQb.getRawOne.mockResolvedValue({ total: '1000' });
      const result = await service.getRevenueData(3);
      expect(result.length).toBe(3);
      expect(result[0].amount).toBe(1000);
    });
  });

  describe('getUserGrowthMonthly', () => {
    it('should return monthly user growth', async () => {
      mockUserRepo.count.mockResolvedValue(20);
      const result = await service.getUserGrowthMonthly(3);
      expect(result.length).toBe(3);
    });
  });

  describe('getRevenueMonthly', () => {
    it('should return monthly revenue', async () => {
      invoiceQb.getRawOne.mockResolvedValue({ total: '5000' });
      const result = await service.getRevenueMonthly(3);
      expect(result.length).toBe(3);
    });
  });

  describe('getAllPlatformUsers', () => {
    it('should return paginated users', async () => {
      userQb.getManyAndCount.mockResolvedValue([[{
        id: '1', firstName: 'John', lastName: 'Doe', email: 'john@test.com',
        roleId: 'admin', isActive: true, isEmailVerified: true, tenantId: 't1', createdAt: new Date(),
      }], 1]);

      const result = await service.getAllPlatformUsers(1, 50);
      expect(result.users.length).toBe(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getAllPlatformBusinesses', () => {
    it('should return paginated businesses with stats', async () => {
      businessQb.getManyAndCount.mockResolvedValue([[{
        id: '1', name: 'Biz1', legalName: 'Biz1 LLC', phone: '123',
        tenantId: 't1', createdAt: new Date(),
      }], 1]);
      mockUserRepo.count.mockResolvedValue(5);
      invoiceQb.getRawOne.mockResolvedValue({ count: '10', total: '5000' });

      const result = await service.getAllPlatformBusinesses(1, 50);
      expect(result.businesses.length).toBe(1);
      expect(result.businesses[0].totalUsers).toBe(5);
    });
  });

  describe('getPlatformActivityLogs', () => {
    it('should return activity logs with user details', async () => {
      mockActivityLogService.getPlatformActivityLogs.mockResolvedValue({
        logs: [{ id: 'log-1', userId: 'user-1', tenantId: 't1', action: 'LOGIN', description: 'Logged in', ipAddress: '127.0.0.1', createdAt: new Date() }],
        total: 1, page: 1, limit: 50,
      });
      mockUserRepo.findOne.mockResolvedValue({ firstName: 'John', lastName: 'Doe', email: 'john@test.com' });
      mockBusinessRepo.findOne.mockResolvedValue({ name: 'Biz1' });

      const result = await service.getPlatformActivityLogs(1, 50);
      expect(result.logs.length).toBe(1);
      expect(result.logs[0].userName).toBe('John Doe');
    });
  });
});
