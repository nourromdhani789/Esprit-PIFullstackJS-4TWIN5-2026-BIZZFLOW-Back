import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { User } from '../user/entities/user.entity';
import { Business } from '../business/entities/business.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { ActivityLog } from '../activity/entities/activity-log.entity';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Business, Invoice, Tenant, ActivityLog]),
    ActivityModule,
  ],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
  exports: [AdminDashboardService],
})
export class AdminDashboardModule {}
