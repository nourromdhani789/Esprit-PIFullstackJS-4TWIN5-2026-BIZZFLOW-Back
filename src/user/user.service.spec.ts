import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '../shared/enums/role.enum';

describe('UserService', () => {
  let service: UserService;
  let repo: Repository<User>;

  const mockRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), remove: jest.fn() };

  const mockUser = {
    id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@test.com',
    phone: '+1234567890', isActive: true, roleId: Role.BUSINESS_OWNER, tenantId: 'tenant-1',
    createdAt: new Date(), updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockRepo.find.mockResolvedValue([mockUser]);
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(repo.find).toHaveBeenCalledWith({ relations: ['tenant'] });
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findOne('user-1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      const result = await service.findByEmail('test@test.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('bad@test.com');
      expect(result).toBeNull();
    });
  });

  describe('findByTenant', () => {
    it('should return users by tenant', async () => {
      mockRepo.find.mockResolvedValue([mockUser]);
      const result = await service.findByTenant('tenant-1');
      expect(result).toEqual([mockUser]);
      expect(repo.find).toHaveBeenCalledWith({ where: { tenantId: 'tenant-1' }, relations: ['tenant'] });
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      mockRepo.save.mockImplementation(u => Promise.resolve({ ...u, firstName: 'Updated' }));

      const result = await service.update('user-1', { firstName: 'Updated' } as any);
      expect(result.firstName).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should remove user', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.remove('user-1');
      expect(repo.remove).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('removeTenantMember', () => {
    it('should remove tenant member', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, tenantId: 'tenant-1', roleId: Role.ACCOUNTANT });
      mockRepo.remove.mockResolvedValue(undefined);

      await service.removeTenantMember('user-1', 'user-2', 'tenant-1');
      expect(repo.remove).toHaveBeenCalled();
    });

    it('should throw when different tenant', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, tenantId: 'other-tenant' });
      await expect(service.removeTenantMember('user-1', 'user-2', 'tenant-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw when deleting self', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      await expect(service.removeTenantMember('user-1', 'user-1', 'tenant-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw when deleting business owner', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      await expect(service.removeTenantMember('user-1', 'user-2', 'tenant-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('activateUser', () => {
    it('should activate user', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, isActive: false });
      mockRepo.save.mockImplementation(u => Promise.resolve({ ...u, isActive: true }));

      const result = await service.activateUser('user-1');
      expect(result.isActive).toBe(true);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user', async () => {
      mockRepo.findOne.mockResolvedValue(mockUser);
      mockRepo.save.mockImplementation(u => Promise.resolve({ ...u, isActive: false }));

      const result = await service.deactivateUser('user-1');
      expect(result.isActive).toBe(false);
    });
  });
});
