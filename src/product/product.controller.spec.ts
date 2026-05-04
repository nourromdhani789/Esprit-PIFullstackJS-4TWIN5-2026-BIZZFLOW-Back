import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('ProductController', () => {
  let controller: ProductController;
  let service: ProductService;

  const mockProductService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findForSales: jest.fn(),
    findForPurchases: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
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

  const mockRequest = {
    user: {
      id: 'user-1',
      email: 'user@test.com',
      businessId: 'business-1',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: mockProductService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductController>(ProductController);
    service = module.get<ProductService>(ProductService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const createDto: CreateProductDto = {
        name: 'New Product',
        price: 150,
        category: 'Furniture',
        description: 'New description',
        initialQuantity: 100,
        minimumStock: 20,
        usedFor: 'sales',
        productType: 'storable',
      };

      mockProductService.create.mockResolvedValue(mockProduct);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockProduct);
      expect(service.create).toHaveBeenCalledWith(
        'business-1',
        createDto,
        'user-1',
        'user@test.com'
      );
    });

    it('should create product with minimal data', async () => {
      const minimalDto: CreateProductDto = {
        name: 'Minimal Product',
        price: 50,
      };

      const minimalProduct = { ...mockProduct, ...minimalDto };
      mockProductService.create.mockResolvedValue(minimalProduct);

      const result = await controller.create(minimalDto, mockRequest);

      expect(result.name).toBe('Minimal Product');
    });

    it('should create service type product', async () => {
      const serviceDto: CreateProductDto = {
        name: 'Consulting Service',
        price: 200,
        productType: 'service',
        usedFor: 'sales',
      };

      const serviceProduct = { ...mockProduct, ...serviceDto, quantity: 0 };
      mockProductService.create.mockResolvedValue(serviceProduct);

      const result = await controller.create(serviceDto, mockRequest);

      expect(result.productType).toBe('service');
    });
  });

  describe('findAll', () => {
    it('should return all products for business', async () => {
      const products = [mockProduct, { ...mockProduct, id: 'product-2', name: 'Product Two' }];
      mockProductService.findAll.mockResolvedValue(products);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual(products);
      expect(service.findAll).toHaveBeenCalledWith('business-1');
    });

    it('should return empty array when no products', async () => {
      mockProductService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('findForSales', () => {
    it('should return products for sales', async () => {
      const salesProducts = [
        { ...mockProduct, usedFor: 'sales' as const },
        { ...mockProduct, id: 'product-2', usedFor: 'both' as const },
      ];
      mockProductService.findForSales.mockResolvedValue(salesProducts);

      const result = await controller.findForSales(mockRequest);

      expect(result).toEqual(salesProducts);
      expect(service.findForSales).toHaveBeenCalledWith('business-1');
    });
  });

  describe('findForPurchases', () => {
    it('should return products for purchases', async () => {
      const purchaseProducts = [
        { ...mockProduct, usedFor: 'purchases' as const },
        { ...mockProduct, id: 'product-2', usedFor: 'both' as const },
      ];
      mockProductService.findForPurchases.mockResolvedValue(purchaseProducts);

      const result = await controller.findForPurchases(mockRequest);

      expect(result).toEqual(purchaseProducts);
      expect(service.findForPurchases).toHaveBeenCalledWith('business-1');
    });
  });

  describe('findOne', () => {
    it('should return a single product by id', async () => {
      mockProductService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne('product-1', mockRequest);

      expect(result).toEqual(mockProduct);
      expect(service.findOne).toHaveBeenCalledWith('product-1', 'business-1');
    });

    it('should throw error when product not found', async () => {
      mockProductService.findOne.mockRejectedValue(new Error('Product not found'));

      await expect(controller.findOne('nonexistent', mockRequest)).rejects.toThrow('Product not found');
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const updateDto: UpdateProductDto = {
        name: 'Updated Name',
        price: 200,
      };

      const updatedProduct = { ...mockProduct, ...updateDto };
      mockProductService.update.mockResolvedValue(updatedProduct);

      const result = await controller.update('product-1', updateDto, mockRequest);

      expect(result).toEqual(updatedProduct);
      expect(service.update).toHaveBeenCalledWith(
        'product-1',
        'business-1',
        updateDto,
        'user-1',
        'user@test.com'
      );
    });

    it('should update product stock quantity', async () => {
      const stockUpdate: UpdateProductDto = {
        minimumStock: 5,
      };

      const updatedProduct = { ...mockProduct, minimumStock: 5 };
      mockProductService.update.mockResolvedValue(updatedProduct);

      const result = await controller.update('product-1', stockUpdate, mockRequest);

      expect(result.minimumStock).toBe(5);
    });
  });

  describe('remove', () => {
    it('should remove a product', async () => {
      mockProductService.remove.mockResolvedValue(undefined);

      await controller.remove('product-1', mockRequest);

      expect(service.remove).toHaveBeenCalledWith(
        'product-1',
        'business-1',
        'user-1',
        'user@test.com'
      );
    });

    it('should throw error when removing non-existent product', async () => {
      mockProductService.remove.mockRejectedValue(new Error('Product not found'));

      await expect(controller.remove('nonexistent', mockRequest)).rejects.toThrow('Product not found');
    });
  });
});
