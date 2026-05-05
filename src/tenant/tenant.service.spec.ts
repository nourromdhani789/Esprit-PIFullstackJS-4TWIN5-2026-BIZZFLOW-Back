import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TenantService', () => {
  let service: TenantService;
  let repo: Repository<Tenant>;

  const mockRepo = { create: jest.fn(), save: jest.fn(), find: jest.fn(), findOne: jest.fn(), remove: jest.fn() };

  const mockTenant = {
    id: 'tenant-1', name: 'Test Tenant', subdomain: 'test-tenant',
    status: 'active', createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: getRepositoryToken(Tenant), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    repo = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create tenant', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue(mockTenant);
      mockRepo.save.mockResolvedValue(mockTenant);

      const result = await service.create({ name: 'Test Tenant', subdomain: 'test-tenant' });
      expect(result).toEqual(mockTenant);
    });

    it('should create tenant successfully', async () => {
      mockRepo.save.mockResolvedValue(mockTenant);
      const result = await service.create({ name: 'Test', subdomain: 'test-tenant' } as any);
      expect(result).toEqual(mockTenant);
    });
  });

  describe('findAll', () => {
    it('should return all tenants', async () => {
      mockRepo.find.mockResolvedValue([mockTenant]);
      const result = await service.findAll();
      expect(result).toEqual([mockTenant]);
    });
  });

  describe('findOne', () => {
    it('should return tenant by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockTenant);
      const result = await service.findOne('tenant-1');
      expect(result).toEqual(mockTenant);
    });

    it('should throw when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySubdomain', () => {
    it('should return tenant by subdomain', async () => {
      mockRepo.findOne.mockResolvedValue(mockTenant);
      const result = await service.findBySubdomain('test-tenant');
      expect(result).toEqual(mockTenant);
    });
  });

  describe('update', () => {
    it('should update tenant', async () => {
      mockRepo.findOne.mockResolvedValue(mockTenant);
      mockRepo.save.mockImplementation(t => Promise.resolve({ ...t, name: 'Updated' }));

      const result = await service.update('tenant-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should remove tenant', async () => {
      mockRepo.findOne.mockResolvedValue(mockTenant);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.remove('tenant-1');
      expect(repo.remove).toHaveBeenCalled();
    });
  });
});
