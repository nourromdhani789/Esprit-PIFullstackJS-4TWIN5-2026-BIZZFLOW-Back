import { Test, TestingModule } from '@nestjs/testing';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('SupplierController', () => {
  let controller: SupplierController;
  let service: SupplierService;

  const mockSupplierService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getProfile: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockSupplier = {
    id: 'supplier-1',
    name: 'Test Supplier',
    email: 'supplier@test.com',
    phone: '+1234567890',
    address: '123 Supplier St',
    businessId: 'business-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequest = {
    user: {
      id: 'user-1',
      email: 'user@test.com',
      businessId: 'business-1',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupplierController],
      providers: [
        {
          provide: SupplierService,
          useValue: mockSupplierService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SupplierController>(SupplierController);
    service = module.get<SupplierService>(SupplierService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new supplier', async () => {
      const createDto: CreateSupplierDto = {
        name: 'New Supplier',
        email: 'new@supplier.com',
        phone: '+1234567890',
        address: '456 New St',
      };

      mockSupplierService.create.mockResolvedValue(mockSupplier);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockSupplier);
      expect(service.create).toHaveBeenCalledWith('business-1', createDto);
    });

    it('should create supplier with minimal data', async () => {
      const minimalDto: CreateSupplierDto = {
        name: 'Minimal Supplier',
      };

      const minimalSupplier = { ...mockSupplier, ...minimalDto };
      mockSupplierService.create.mockResolvedValue(minimalSupplier);

      const result = await controller.create(minimalDto, mockRequest);

      expect(result.name).toBe('Minimal Supplier');
    });
  });

  describe('findAll', () => {
    it('should return all suppliers for business', async () => {
      const suppliers = [mockSupplier, { ...mockSupplier, id: 'supplier-2', name: 'Supplier Two' }];
      mockSupplierService.findAll.mockResolvedValue(suppliers);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual(suppliers);
      expect(service.findAll).toHaveBeenCalledWith('business-1');
    });

    it('should return empty array when no suppliers', async () => {
      mockSupplierService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single supplier by id', async () => {
      mockSupplierService.findOne.mockResolvedValue(mockSupplier);

      const result = await controller.findOne('supplier-1', mockRequest);

      expect(result).toEqual(mockSupplier);
      expect(service.findOne).toHaveBeenCalledWith('supplier-1', 'business-1');
    });

    it('should throw error when supplier not found', async () => {
      mockSupplierService.findOne.mockRejectedValue(new Error('Supplier not found'));

      await expect(controller.findOne('nonexistent', mockRequest)).rejects.toThrow('Supplier not found');
    });
  });

  describe('getProfile', () => {
    it('should return supplier profile with stats', async () => {
      const profile = {
        supplier: mockSupplier,
        stats: {
          totalPurchased: 10000,
          totalPaid: 8000,
          outstandingBalance: 2000,
          orderCount: 10,
          expenseCount: 5,
        },
        purchaseOrders: [],
        expenses: [],
        payments: [],
      };
      mockSupplierService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('supplier-1', mockRequest);

      expect(result).toEqual(profile);
      expect(service.getProfile).toHaveBeenCalledWith('supplier-1', 'business-1');
    });
  });

  describe('update', () => {
    it('should update a supplier', async () => {
      const updateDto: UpdateSupplierDto = {
        name: 'Updated Name',
        email: 'updated@supplier.com',
      };

      const updatedSupplier = { ...mockSupplier, ...updateDto };
      mockSupplierService.update.mockResolvedValue(updatedSupplier);

      const result = await controller.update('supplier-1', updateDto, mockRequest);

      expect(result).toEqual(updatedSupplier);
      expect(service.update).toHaveBeenCalledWith('supplier-1', 'business-1', updateDto);
    });

    it('should update supplier with partial data', async () => {
      const partialUpdate: UpdateSupplierDto = {
        phone: '+9999999999',
      };

      const updatedSupplier = { ...mockSupplier, phone: '+9999999999' };
      mockSupplierService.update.mockResolvedValue(updatedSupplier);

      const result = await controller.update('supplier-1', partialUpdate, mockRequest);

      expect(result.phone).toBe('+9999999999');
    });
  });

  describe('remove', () => {
    it('should remove a supplier', async () => {
      mockSupplierService.remove.mockResolvedValue(undefined);

      await controller.remove('supplier-1', mockRequest);

      expect(service.remove).toHaveBeenCalledWith('supplier-1', 'business-1');
    });

    it('should throw error when removing non-existent supplier', async () => {
      mockSupplierService.remove.mockRejectedValue(new Error('Supplier not found'));

      await expect(controller.remove('nonexistent', mockRequest)).rejects.toThrow('Supplier not found');
    });
  });
});
