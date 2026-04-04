import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { Invoice, InvoiceStatus } from '../invoice/entities/invoice.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Role } from '../shared/enums/role.enum';
import {
  DashboardMetricsDto,
  RecentUserDto,
  RecentBusinessDto,
  UserGrowthDataDto,
  RevenueDataDto,
} from './dtos/dashboard.dto';
import { ActivityLogService } from '../activity/activity-log.service';
import { ActivityAction } from '../activity/entities/activity-log.entity';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private activityLogService: ActivityLogService,
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetricsDto> {
    const [
      totalUsers,
      totalBusinesses,
      activeUsers,
      inactiveUsers,
      newUsersThisWeek,
      totalInvoices,
      totalRevenue,
    ] = await Promise.all([
      this.getTotalUsers(),
      this.getTotalBusinesses(),
      this.getActiveUsers(),
      this.getInactiveUsers(),
      this.getNewUsersThisWeek(),
      this.getTotalInvoices(),
      this.getTotalRevenue(),
    ]);

    return {
      totalUsers,
      totalBusinesses,
      activeUsers,
      inactiveUsers,
      newUsersThisWeek,
      totalInvoices,
      totalRevenue,
    };
  }

  private async getTotalUsers(): Promise<number> {
    return this.userRepository.count();
  }

  private async getTotalBusinesses(): Promise<number> {
    return this.businessRepository.count();
  }

  private async getActiveUsers(): Promise<number> {
    return this.userRepository.count({ where: { isActive: true } });
  }

  private async getInactiveUsers(): Promise<number> {
    return this.userRepository.count({ where: { isActive: false } });
  }

  private async getNewUsersThisWeek(): Promise<number> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return this.userRepository.count({
      where: {
        createdAt: MoreThanOrEqual(oneWeekAgo),
      },
    });
  }

  private async getTotalInvoices(): Promise<number> {
    return this.invoiceRepository.count();
  }

  private async getTotalRevenue(): Promise<number> {
    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.totalAmount)', 'total')
      .where('invoice.status = :status', { status: InvoiceStatus.PAID })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  async getRecentUsers(limit: number = 10): Promise<RecentUserDto[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      select: ['id', 'firstName', 'lastName', 'email', 'roleId', 'isActive', 'createdAt'],
    });

    return users.map(user => ({
      id: user.id!,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roleId: user.roleId,
      isActive: user.isActive,
      createdAt: user.createdAt,
    }));
  }

  async getRecentBusinesses(limit: number = 10): Promise<RecentBusinessDto[]> {
    const businesses = await this.businessRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['tenant', 'tenant.user'],
    });

    return businesses.map(business => {
      const tenant = business.tenant;
      const owner = tenant?.user;

      return {
        id: business.id,
        name: business.name,
        legalName: business.legalName || null,
        tenantId: business.tenantId,
        ownerEmail: owner?.email || 'N/A',
        ownerName: owner ? `${owner.firstName} ${owner.lastName}` : 'N/A',
        createdAt: business.createdAt,
      };
    });
  }

  async getUserGrowthData(days: number = 7): Promise<UserGrowthDataDto[]> {
    const data: UserGrowthDataDto[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await this.userRepository.count({
        where: {
          createdAt: Between(date, nextDate),
        },
      });

      data.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    return data;
  }

  async getRevenueData(days: number = 7): Promise<RevenueDataDto[]> {
    const data: RevenueDataDto[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const result = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.totalAmount), 0)', 'total')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice.createdAt BETWEEN :start AND :end', {
          start: date,
          end: nextDate,
        })
        .getRawOne();

      data.push({
        date: date.toISOString().split('T')[0],
        amount: parseFloat(result?.total || '0'),
      });
    }

    return data;
  }

  async getUserGrowthMonthly(months: number = 6): Promise<UserGrowthDataDto[]> {
    const data: UserGrowthDataDto[] = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

      const count = await this.userRepository.count({
        where: {
          createdAt: Between(date, nextMonth),
        },
      });

      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      data.push({
        date: monthName,
        count,
      });
    }

    return data;
  }

  async getRevenueMonthly(months: number = 6): Promise<RevenueDataDto[]> {
    const data: RevenueDataDto[] = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

      const result = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.totalAmount), 0)', 'total')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('invoice.createdAt BETWEEN :start AND :end', {
          start: date,
          end: nextMonth,
        })
        .getRawOne();

      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      data.push({
        date: monthName,
        amount: parseFloat(result?.total || '0'),
      });
    }

    return data;
  }

  // ============================================
  // PLATFORM-WIDE DATA ACCESS (Multi-tenant)
  // ============================================

  async getAllPlatformUsers(
    page: number = 1,
    limit: number = 50,
    search?: string,
    role?: string,
    isActive?: boolean,
  ): Promise<{
    users: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.tenant', 'tenant')
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      queryBuilder.andWhere(
        '(user.firstName LIKE :search OR user.lastName LIKE :search OR user.email LIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (role) {
      queryBuilder.andWhere('user.roleId = :role', { role });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    const [users, total] = await queryBuilder.getManyAndCount();

    return {
      users: users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roleId: user.roleId,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        tenantId: user.tenantId,
        createdAt: user.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async getAllPlatformBusinesses(
    page: number = 1,
    limit: number = 50,
    search?: string,
    isActive?: boolean,
  ): Promise<{
    businesses: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const queryBuilder = this.businessRepository.createQueryBuilder('business')
        .orderBy('business.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      if (search) {
        queryBuilder.andWhere(
          '(business.name LIKE :search OR business.legalName LIKE :search)',
          { search: `%${search}%` }
        );
      }

      const [businesses, total] = await queryBuilder.getManyAndCount();

      // Get additional stats for each business
      const businessesWithStats = await Promise.all(
        businesses.map(async (business) => {
          const userCount = await this.userRepository.count({
            where: { tenantId: business.tenantId },
          });

          const invoiceStats = await this.invoiceRepository
            .createQueryBuilder('invoice')
            .select('COUNT(*)', 'count')
            .addSelect('COALESCE(SUM(invoice.totalAmount), 0)', 'total')
            .where('invoice.businessId = :businessId', { businessId: business.id })
            .andWhere('invoice.status = :status', { status: InvoiceStatus.PAID })
            .getRawOne();

          return {
            id: business.id,
            name: business.name,
            legalName: business.legalName,
            phone: business.phone,
            tenantId: business.tenantId,
            totalUsers: userCount,
            totalInvoices: parseInt(invoiceStats?.count || '0'),
            totalRevenue: parseFloat(invoiceStats?.total || '0'),
            createdAt: business.createdAt,
            subscriptionPlan: 'FREE',
            subscriptionStatus: 'Active',
          };
        })
      );

      return {
        businesses: businessesWithStats,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('Error in getAllPlatformBusinesses:', error);
      throw error;
    }
  }

  async getPlatformActivityLogs(
    page: number = 1,
    limit: number = 50,
    action?: ActivityAction,
    userId?: string,
    tenantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    logs: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const result = await this.activityLogService.getPlatformActivityLogs(
      page,
      limit,
      action,
      userId,
      tenantId,
      startDate,
      endDate,
    );

    // Transform logs to include user and business info
    const logsWithDetails = await Promise.all(
      result.logs.map(async (log) => {
        const user = await this.userRepository.findOne({
          where: { id: log.userId },
        });

        let businessName: string | null = null;
        if (log.tenantId) {
          const business = await this.businessRepository.findOne({
            where: { tenantId: log.tenantId },
          });
          businessName = business?.name || null;
        }

        return {
          id: log.id,
          userId: log.userId,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          userEmail: user?.email || 'Unknown',
          businessName,
          tenantId: log.tenantId,
          action: log.action,
          details: log.description,
          ipAddress: log.ipAddress,
          timestamp: log.createdAt,
        };
      }),
    );

    return {
      logs: logsWithDetails,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
