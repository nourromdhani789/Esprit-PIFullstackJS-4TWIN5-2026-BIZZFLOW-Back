import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    userEmail: string,
    action: string,
    entityType: string,
    entityId: string,
    details: any,
    businessId: string,
  ): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      userId,
      userEmail,
      action,
      entityType,
      entityId,
      details,
      businessId,
    });

    return await this.auditLogRepository.save(auditLog);
  }

  async findAll(businessId: string, filters?: AuditLogFilters): Promise<AuditLog[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.businessId = :businessId', { businessId })
      .orderBy('audit.createdAt', 'DESC');

    if (filters?.entityType) {
      query.andWhere('audit.entityType = :entityType', { entityType: filters.entityType });
    }

    if (filters?.entityId) {
      query.andWhere('audit.entityId = :entityId', { entityId: filters.entityId });
    }

    if (filters?.userId) {
      query.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters?.dateFrom) {
      query.andWhere('audit.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters?.dateTo) {
      query.andWhere('audit.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    return await query.getMany();
  }

  async findAllPaginated(
    businessId: string,
    limit: number,
    skip: number,
  ): Promise<[AuditLog[], number]> {
    return await this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.businessId = :businessId', { businessId })
      .orderBy('audit.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
  }
}
