import { Test, TestingModule } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Business } from './entities/business.entity';
import { BusinessCategory } from './entities/business-category.entity';
import { Repository } from 'typeorm';

describe('BusinessService', () => {
  let service: BusinessService;
  let businessRepository: jest.Mocked<Repository<Business>>;
  let categoryRepository: jest.Mocked<Repository<BusinessCategory>>;

  const mockBusinessRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  });

  const mockCategoryRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository(),
        },
        {
          provide: getRepositoryToken(BusinessCategory),
          useValue: mockCategoryRepository(),
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
    businessRepository = module.get(getRepositoryToken(Business));
    categoryRepository = module.get(getRepositoryToken(BusinessCategory));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'Test Business',
      email: 'test@business.com',
      phone: '+1234567890',
      address: '123 Test Street',
      taxId: 'TAX123456',
      taxRate: 20,
      logo: 'logo.png',
    };

    it('should create a new business with tenant association', async () => {
      const tenantId = 'tenant-1';
      const newBusiness = {
        id: 'business-1',
        ...createDto,
        tenantId,
      };

      businessRepository.create.mockReturnValue(newBusiness as unknown as Business);
      businessRepository.save.mockResolvedValue(newBusiness as unknown as Business);

      const result = await service.create(createDto, tenantId);

      expect(result).toEqual(newBusiness);
      expect(businessRepository.create).toHaveBeenCalledWith({
        ...createDto,
        tenantId,
      });
      expect(businessRepository.save).toHaveBeenCalledWith(newBusiness);
    });

    it('should handle decimal tax rate conversion', async () => {
      const tenantId = 'tenant-1';
      const newBusiness = {
        id: 'business-1',
        ...createDto,
        taxRate: 20.5,
        tenantId,
      };

      businessRepository.create.mockReturnValue(newBusiness as unknown as Business);
      businessRepository.save.mockResolvedValue(newBusiness as unknown as Business);

      const result = await service.create(createDto, tenantId);

      expect(result).toEqual(newBusiness);
    });
  });

  describe('findAll', () => {
    it('should return all businesses with converted tax rates', async () => {
      const businesses = [
        { id: '1', name: 'Business 1', taxRate: 20 },
        { id: '2', name: 'Business 2', taxRate: '15.5' },
        { id: '3', name: 'Business 3' },
      ];

      businessRepository.find.mockResolvedValue(businesses as unknown as Business[]);

      const result = await service.findAll();

      expect(result).toHaveLength(3);
      expect(businessRepository.find).toHaveBeenCalled();
    });

    it('should convert string tax rates to numbers', async () => {
      const businesses = [
        { id: '1', name: 'Business 1', taxRate: '18.5' },
      ];

      businessRepository.find.mockResolvedValue(businesses as unknown as Business[]);

      const result = await service.findAll();

      expect(typeof result[0].taxRate).toBe('number');
    });
  });

  describe('findOne', () => {
    it('should return a business by id', async () => {
      const business = {
        id: 'business-1',
        name: 'Test Business',
        taxRate: 20,
      };

      businessRepository.findOne.mockResolvedValue(business as unknown as Business);

      const result = await service.findOne('business-1');

      expect(result).toEqual(business);
      expect(businessRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'business-1' },
      });
    });

    it('should throw NotFoundException if business not found', async () => {
      businessRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should convert tax rate to number if defined', async () => {
      const business = {
        id: 'business-1',
        name: 'Test Business',
        taxRate: '25.5',
      };

      businessRepository.findOne.mockResolvedValue(business as unknown as Business);

      const result = await service.findOne('business-1');

      expect(typeof result.taxRate).toBe('number');
    });
  });

  describe('findByTenant', () => {
    it('should return business for a given tenant', async () => {
      const businesses = [
        { id: 'business-1', name: 'Test Business', tenantId: 'tenant-1' },
      ];

      businessRepository.find.mockResolvedValue(businesses as unknown as Business[]);

      const result = await service.findByTenant('tenant-1');

      expect(result).toEqual(businesses[0]);
      expect(businessRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        take: 1,
      });
    });

    it('should return null if no business found for tenant', async () => {
      businessRepository.find.mockResolvedValue([]);

      const result = await service.findByTenant('tenant-1');

      expect(result).toBeNull();
    });

    it('should convert tax rate to number if business found', async () => {
      const businesses = [
        { id: 'business-1', name: 'Test Business', tenantId: 'tenant-1', taxRate: '18.5' },
      ];

      businessRepository.find.mockResolvedValue(businesses as unknown as Business[]);

      const result = await service.findByTenant('tenant-1');

      expect(result).toBeDefined();
      expect(typeof result!.taxRate).toBe('number');
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Business Name',
      email: 'updated@business.com',
    };

    it('should update an existing business', async () => {
      const existingBusiness = {
        id: 'business-1',
        name: 'Old Name',
        email: 'old@business.com',
      };

      const updatedBusiness = {
        ...existingBusiness,
        ...updateDto,
      };

      businessRepository.findOne.mockResolvedValue(existingBusiness as unknown as Business);
      businessRepository.save.mockResolvedValue(updatedBusiness as unknown as Business);

      const result = await service.update('business-1', updateDto);

      expect((result as any).name).toBe(updateDto.name);
      expect((result as any).email).toBe(updateDto.email);
      expect(businessRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent business', async () => {
      businessRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should preserve existing fields not in update DTO', async () => {
      const existingBusiness = {
        id: 'business-1',
        name: 'Old Name',
        email: 'old@business.com',
        taxId: 'TAX123',
        phone: '+1234567890',
      };

      const partialUpdate = { name: 'New Name' };

      businessRepository.findOne.mockResolvedValue(existingBusiness as unknown as Business);
      businessRepository.save.mockResolvedValue({
        ...existingBusiness,
        ...partialUpdate,
      } as unknown as Business);

      const result = await service.update('business-1', partialUpdate);

      expect((result as any).taxId).toBe('TAX123');
      expect((result as any).phone).toBe('+1234567890');
    });
  });

  describe('remove', () => {
    it('should delete a business', async () => {
      const business = {
        id: 'business-1',
        name: 'Test Business',
      };

      businessRepository.findOne.mockResolvedValue(business as unknown as Business);
      businessRepository.remove.mockResolvedValue(business as unknown as Business);

      await service.remove('business-1');

      expect(businessRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'business-1' },
      });
      expect(businessRepository.remove).toHaveBeenCalledWith(business);
    });

    it('should throw NotFoundException when deleting non-existent business', async () => {
      businessRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
