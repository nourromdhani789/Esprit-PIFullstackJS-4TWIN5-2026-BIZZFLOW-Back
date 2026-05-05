import { Test, TestingModule } from '@nestjs/testing';
import { ActivityLogService } from './activity-log.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivityLog, ActivityAction } from './entities/activity-log.entity';
import { Repository } from 'typeorm';

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let repository: Repository<ActivityLog>;

  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const mockLog = {
    id: 'log-1',
    userId: 'user-1',
    action: ActivityAction.LOGIN,
    tenantId: 'tenant-1',
    description: 'User logged in',
    metadata: { ip: '127.0.0.1' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: getRepositoryToken(ActivityLog), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ActivityLogService>(ActivityLogService);
    repository = module.get<Repository<ActivityLog>>(getRepositoryToken(ActivityLog));
    jest.clearAllMocks();
    queryBuilder.getManyAndCount.mockReset();
  });

  describe('createLog', () => {
    it('should create activity log', async () => {
      mockRepository.create.mockReturnValue(mockLog);
      mockRepository.save.mockResolvedValue(mockLog);

      const result = await service.createLog(
        'user-1',
        ActivityAction.LOGIN,
        'tenant-1',
        'User logged in',
        { ip: '127.0.0.1' },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual(mockLog);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('getPlatformActivityLogs', () => {
    it('should return paginated logs', async () => {
      const logs = [mockLog];
      queryBuilder.getManyAndCount.mockResolvedValue([logs, 1]);

      const result = await service.getPlatformActivityLogs(1, 50);

      expect(result.logs).toEqual(logs);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should apply action filter', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[mockLog], 1]);

      await service.getPlatformActivityLogs(1, 50, ActivityAction.LOGIN);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.action = :action', { action: ActivityAction.LOGIN });
    });

    it('should apply userId filter', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[mockLog], 1]);

      await service.getPlatformActivityLogs(1, 50, undefined, 'user-1');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.userId = :userId', { userId: 'user-1' });
    });

    it('should apply tenantId filter', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[mockLog], 1]);

      await service.getPlatformActivityLogs(1, 50, undefined, undefined, 'tenant-1');

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.tenantId = :tenantId', { tenantId: 'tenant-1' });
    });

    it('should apply date range filter', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      queryBuilder.getManyAndCount.mockResolvedValue([[mockLog], 1]);

      await service.getPlatformActivityLogs(1, 50, undefined, undefined, undefined, startDate, endDate);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    });
  });

  describe('getRecentActivityByUser', () => {
    it('should return recent activity for user', async () => {
      mockRepository.find.mockResolvedValue([mockLog]);

      const result = await service.getRecentActivityByUser('user-1', 10);

      expect(result).toEqual([mockLog]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getRecentActivityByTenant', () => {
    it('should return recent activity for tenant', async () => {
      mockRepository.find.mockResolvedValue([mockLog]);

      const result = await service.getRecentActivityByTenant('tenant-1', 50);

      expect(result).toEqual([mockLog]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
    });
  });
});
