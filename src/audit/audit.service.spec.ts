import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { Repository } from 'typeorm';

describe('AuditService', () => {
  let service: AuditService;
  let repository: Repository<AuditLog>;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const mockAuditLog = {
    id: 'audit-1',
    userId: 'user-1',
    userEmail: 'user@test.com',
    action: 'created_product',
    entityType: 'Product',
    entityId: 'product-1',
    details: { name: 'Test Product' },
    businessId: 'business-1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
    jest.clearAllMocks();
    queryBuilder.getMany.mockReset();
    queryBuilder.getManyAndCount.mockReset();
  });

  describe('log', () => {
    it('should create audit log', async () => {
      mockRepository.create.mockReturnValue(mockAuditLog);
      mockRepository.save.mockResolvedValue(mockAuditLog);

      const result = await service.log(
        'user-1',
        'user@test.com',
        'created_product',
        'Product',
        'product-1',
        { name: 'Test Product' },
        'business-1',
      );

      expect(result).toEqual(mockAuditLog);
      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        userEmail: 'user@test.com',
        action: 'created_product',
        entityType: 'Product',
        entityId: 'product-1',
        details: { name: 'Test Product' },
        businessId: 'business-1',
      });
    });
  });

  describe('findAll', () => {
    it('should return all audit logs for business', async () => {
      queryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      const result = await service.findAll('business-1');

      expect(result).toEqual([mockAuditLog]);
    });

    it('should apply entityType filter', async () => {
      queryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.findAll('business-1', { entityType: 'Product' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('audit.entityType = :entityType', { entityType: 'Product' });
    });

    it('should apply entityId filter', async () => {
      queryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.findAll('business-1', { entityId: 'product-1' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('audit.entityId = :entityId', { entityId: 'product-1' });
    });

    it('should apply userId filter', async () => {
      queryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.findAll('business-1', { userId: 'user-1' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('audit.userId = :userId', { userId: 'user-1' });
    });

    it('should apply date range filters', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');
      queryBuilder.getMany.mockResolvedValue([mockAuditLog]);

      await service.findAll('business-1', { dateFrom, dateTo });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('audit.createdAt >= :dateFrom', { dateFrom });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('audit.createdAt <= :dateTo', { dateTo });
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated results', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[mockAuditLog], 1]);

      const [logs, total] = await service.findAllPaginated('business-1', 20, 0);

      expect(logs).toEqual([mockAuditLog]);
      expect(total).toBe(1);
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
    });
  });
});
