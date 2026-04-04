import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../shared/enums/role.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  DashboardMetricsDto,
  RecentUserDto,
  RecentBusinessDto,
  UserGrowthDataDto,
  RevenueDataDto,
} from './dtos/dashboard.dto';
import { ActivityAction } from '../activity/entities/activity-log.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('dashboard')
  async getDashboardMetrics(): Promise<DashboardMetricsDto> {
    return this.adminDashboardService.getDashboardMetrics();
  }

  @Get('recent-users')
  async getRecentUsers(@Query('limit') limit?: string): Promise<RecentUserDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.adminDashboardService.getRecentUsers(parsedLimit);
  }

  @Get('recent-businesses')
  async getRecentBusinesses(@Query('limit') limit?: string): Promise<RecentBusinessDto[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.adminDashboardService.getRecentBusinesses(parsedLimit);
  }

  @Get('user-growth')
  async getUserGrowth(@Query('days') days?: string): Promise<UserGrowthDataDto[]> {
    const parsedDays = days ? parseInt(days, 10) : 7;
    return this.adminDashboardService.getUserGrowthData(parsedDays);
  }

  @Get('user-growth-monthly')
  async getUserGrowthMonthly(@Query('months') months?: string): Promise<UserGrowthDataDto[]> {
    const parsedMonths = months ? parseInt(months, 10) : 6;
    return this.adminDashboardService.getUserGrowthMonthly(parsedMonths);
  }

  @Get('revenue')
  async getRevenue(@Query('days') days?: string): Promise<RevenueDataDto[]> {
    const parsedDays = days ? parseInt(days, 10) : 7;
    return this.adminDashboardService.getRevenueData(parsedDays);
  }

  @Get('revenue-monthly')
  async getRevenueMonthly(@Query('months') months?: string): Promise<RevenueDataDto[]> {
    const parsedMonths = months ? parseInt(months, 10) : 6;
    return this.adminDashboardService.getRevenueMonthly(parsedMonths);
  }

  // ============================================
  // PLATFORM-WIDE DATA ENDPOINTS
  // ============================================

  @Get('users')
  async getAllPlatformUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.adminDashboardService.getAllPlatformUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
      role,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Get('businesses')
  async getAllPlatformBusinesses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.adminDashboardService.getAllPlatformBusinesses(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      search,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Get('activity-logs')
  async getPlatformActivityLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: ActivityAction,
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminDashboardService.getPlatformActivityLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      action,
      userId,
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
