export interface DashboardMetricsDto {
  totalUsers: number;
  totalBusinesses: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersThisWeek: number;
  totalInvoices: number;
  totalRevenue: number;
}

export interface UserGrowthDataDto {
  date: string;
  count: number;
}

export interface RevenueDataDto {
  date: string;
  amount: number;
}

export interface RecentUserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface RecentBusinessDto {
  id: string;
  name: string;
  legalName: string | null;
  tenantId: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: Date;
}
