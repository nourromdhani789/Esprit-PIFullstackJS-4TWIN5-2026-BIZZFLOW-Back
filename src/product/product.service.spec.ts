import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notification/notification.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

describe('ProductService', () => {
  let service: ProductService;
  let productRepository: Repository<Product>;
  let stockMovementRepository: Repository<StockMovement>;
  let auditService: AuditService;
  let notificationService: NotificationService;

  const mockProductRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockStockMovementRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockNotificationService = {
    create: jest.fn(),
  };

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    price: 100,
    quantity: 50,
    category: 'Electronics',
    description: 'Test description',
    minimumStock: 10,
    usedFor: 'sales' as const,
    productType: 'storable' as const,
    businessId: 'business-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(StockMovement),
          useValue: mockStockMovementRepository,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    productRepository = module.get<Repository<Product>>(getRepositoryToken(Product));
    stockMovementRepository = module.get<Repository<StockMovement>>(getRepositoryToken(StockMovement));
    auditService = module.get<AuditService>(AuditService);
    notificationService = module.get<NotificationService>(NotificationService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const createDto: CreateProductDto = {
        name: 'New Product',
        price: 150,
        category: 'Furniture',
        initialQuantity: 100,
        minimumStock: 20,
      };

      mockProductRepository.create.mockReturnValue(mockProduct);
      mockProductRepository.save.mockResolvedValue(mockProduct);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', createDto, 'user-1', 'user@test.com');

      expect(result).toEqual(mockProduct);
      expect(productRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        name: createDto.name,
        price: createDto.price,
        businessId: 'business-1',
      }));
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should create product without initial quantity', async () => {
      const createDto: CreateProductDto = {
        name: 'Service Product',
        price: 200,
        productType: 'service',
      };

      mockProductRepository.create.mockReturnValue({ ...mockProduct, quantity: 0 });
      mockProductRepository.save.mockResolvedValue({ ...mockProduct, quantity: 0 });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.create('business-1', createDto);

      expect(result.quantity).toBe(0);
      expect(stockMovementRepository.create).not.toHaveBeenCalled();
    });

    it('should create stock movement when initial quantity > 0', async () => {
      const createDto: CreateProductDto = {
        name: 'Stock Product',
        price: 100,
        initialQuantity: 50,
      };

      const savedProduct = { ...mockProduct, id: 'new-id' };
      mockProductRepository.create.mockReturnValue(savedProduct);
      mockProductRepository.save.mockResolvedValue(savedProduct);
      mockStockMovementRepository.create.mockReturnValue({});
      mockStockMovementRepository.save.mockResolvedValue({});
      mockAuditService.log.mockResolvedValue(undefined);

      await service.create('business-1', createDto, 'user-1', 'user@test.com');

      expect(stockMovementRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        productId: 'new-id',
        type: 'IN',
        quantity: 50,
        reason: 'initial',
      }));
    });
  });

  describe('findAll', () => {
    it('should return all products for business', async () => {
      const products = [mockProduct, { ...mockProduct, id: 'product-2' }];
      mockProductRepository.find.mockResolvedValue(products);

      const result = await service.findAll('business-1');

      expect(result).toEqual(products);
      expect(productRepository.find).toHaveBeenCalledWith({
        where: { businessId: 'business-1' },
        order: { createdAt: 'DESC' },
      });
    });

    it('should return all products when no businessId', async () => {
      const products = [mockProduct];
      mockProductRepository.find.mockResolvedValue(products);

      const result = await service.findAll('');

      expect(result).toEqual(products);
      expect(productRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      mockProductRepository.findOne.mockResolvedValue(mockProduct);

      const result = await service.findOne('product-1', 'business-1');

      expect(result).toEqual(mockProduct);
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-1', businessId: 'business-1' },
      });
    });

    it('should throw NotFoundException when product not found', async () => {
      mockProductRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'business-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const updateDto: UpdateProductDto = {
        name: 'Updated Name',
        price: 200,
      };

      mockProductRepository.findOne.mockResolvedValue({ ...mockProduct });
      mockProductRepository.save.mockResolvedValue({ ...mockProduct, ...updateDto });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.update('product-1', 'business-1', updateDto, 'user-1', 'user@test.com');

      expect(result.name).toBe('Updated Name');
      expect(result.price).toBe(200);
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should log price change in audit', async () => {
      const updateDto: UpdateProductDto = {
        price: 150,
      };

      mockProductRepository.findOne.mockResolvedValue({ ...mockProduct });
      mockProductRepository.save.mockImplementation(p => Promise.resolve(p));
      mockAuditService.log.mockResolvedValue(undefined);

      await service.update('product-1', 'business-1', updateDto, 'user-1', 'user@test.com');

      expect(auditService.log).toHaveBeenCalledWith(
        'user-1',
        'user@test.com',
        'updated_product',
        'Product',
        'product-1',
        expect.objectContaining({
          priceChanged: true,
          previousPrice: 100,
          newPrice: 150,
        }),
        'business-1'
      );
    });
  });

  describe('remove', () => {
    it('should remove a product', async () => {
      mockProductRepository.findOne.mockResolvedValue({ ...mockProduct });
      mockProductRepository.remove.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      await service.remove('product-1', 'business-1', 'user-1', 'user@test.com');

      expect(productRepository.remove).toHaveBeenCalledWith(mockProduct);
      expect(auditService.log).toHaveBeenCalledWith(
        'user-1',
        'user@test.com',
        'deleted_product',
        'Product',
        'product-1',
        expect.any(Object),
        'business-1'
      );
    });
  });

  describe('findForSales', () => {
    it('should return products for sales', async () => {
      const salesProducts = [
        { ...mockProduct, usedFor: 'sales' as const },
        { ...mockProduct, id: 'product-2', usedFor: 'both' as const },
      ];
      mockProductRepository.find.mockResolvedValue(salesProducts);

      const result = await service.findForSales('business-1');

      expect(result).toEqual(salesProducts);
      expect(productRepository.find).toHaveBeenCalledWith({
        where: [
          { businessId: 'business-1', usedFor: 'sales' },
          { businessId: 'business-1', usedFor: 'both' },
        ],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findForPurchases', () => {
    it('should return products for purchases', async () => {
      const purchaseProducts = [
        { ...mockProduct, usedFor: 'purchases' as const },
        { ...mockProduct, id: 'product-2', usedFor: 'both' as const },
      ];
      mockProductRepository.find.mockResolvedValue(purchaseProducts);

      const result = await service.findForPurchases('business-1');

      expect(result).toEqual(purchaseProducts);
      expect(productRepository.find).toHaveBeenCalledWith({
        where: [
          { businessId: 'business-1', usedFor: 'purchases' },
          { businessId: 'business-1', usedFor: 'both' },
        ],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('checkStockAndNotify', () => {
    it('should create notification when out of stock', async () => {
      const outOfStockProduct = { ...mockProduct, quantity: 0, minimumStock: 10 };
      mockNotificationService.create.mockResolvedValue(undefined);

      await service.checkStockAndNotify(outOfStockProduct);

      expect(notificationService.create).toHaveBeenCalledWith(
        'business-1',
        'Out of Stock',
        expect.stringContaining('completely out of stock'),
        'error',
        'stock',
        '/products/product-1',
        'product-1',
        'Product'
      );
    });

    it('should create notification when low stock', async () => {
      const lowStockProduct = { ...mockProduct, quantity: 5, minimumStock: 10 };
      mockNotificationService.create.mockResolvedValue(undefined);

      await service.checkStockAndNotify(lowStockProduct);

      expect(notificationService.create).toHaveBeenCalledWith(
        'business-1',
        'Low Stock Alert',
        expect.stringContaining('below minimum stock'),
        'warning',
        'stock',
        '/products/product-1',
        'product-1',
        'Product'
      );
    });

    it('should not create notification when stock is sufficient', async () => {
      const sufficientStockProduct = { ...mockProduct, quantity: 50, minimumStock: 10 };

      await service.checkStockAndNotify(sufficientStockProduct);

      expect(notificationService.create).not.toHaveBeenCalled();
    });

    it('should handle error silently when notification fails', async () => {
      const outOfStockProduct = { ...mockProduct, quantity: 0, minimumStock: 10 };
      mockNotificationService.create.mockRejectedValue(new Error('Notification failed'));

      await expect(service.checkStockAndNotify(outOfStockProduct)).resolves.not.toThrow();
    });
  });
});
