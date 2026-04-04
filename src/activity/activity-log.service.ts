import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ActivityLog, ActivityAction } from './entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
  ) {}

  async createLog(
    userId: string,
    action: ActivityAction,
    tenantId: string | undefined,
    description?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<ActivityLog> {
    const log = this.activityLogRepository.create({
      userId,
      action,
      tenantId,
      description,
      metadata,
      ipAddress,
      userAgent,
    });

    return this.activityLogRepository.save(log);
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
    logs: ActivityLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }

    if (userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId });
    }

    if (tenantId) {
      queryBuilder.andWhere('log.tenantId = :tenantId', { tenantId });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const [logs, total] = await queryBuilder.getManyAndCount();

    return {
      logs,
      total,
      page,
      limit,
    };
  }

  async getRecentActivityByUser(
    userId: string,
    limit: number = 10,
  ): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentActivityByTenant(
    tenantId: string,
    limit: number = 50,
  ): Promise<ActivityLog[]> {
    return this.activityLogRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
