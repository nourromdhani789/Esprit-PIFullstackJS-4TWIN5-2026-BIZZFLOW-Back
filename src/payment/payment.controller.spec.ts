import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CreatePaymentDto, UpdatePaymentDto, PaymentFilterDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('PaymentController', () => {
  let controller: PaymentController;
  let service: PaymentService;

  const mockPaymentService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockPayment = {
    id: 'payment-1',
    type: 'IN' as const,
    amount: 500,
    method: 'cash' as const,
    description: 'Invoice payment',
    reference: 'INV-001',
    referenceId: 'invoice-1',
    referenceType: 'invoice',
    businessId: 'business-1',
    date: new Date(),
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
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentController>(PaymentController);
    service = module.get<PaymentService>(PaymentService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new payment', async () => {
      const createDto: CreatePaymentDto = {
        type: 'IN',
        amount: 500,
        method: 'cash',
        description: 'Invoice payment',
      };

      mockPaymentService.create.mockResolvedValue(mockPayment);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockPayment);
      expect(service.create).toHaveBeenCalledWith('business-1', createDto, 'user-1', 'user@test.com');
    });

    it('should create an OUT payment', async () => {
      const createDto: CreatePaymentDto = {
        type: 'OUT',
        amount: 200,
        method: 'bank',
        reference: 'REF-002',
      };

      const outPayment = { ...mockPayment, type: 'OUT', amount: 200, method: 'bank' };
      mockPaymentService.create.mockResolvedValue(outPayment);

      const result = await controller.create(createDto, mockRequest);

      expect(result.type).toBe('OUT');
      expect(result.method).toBe('bank');
    });
  });

  describe('findAll', () => {
    it('should return all payments for business', async () => {
      const payments = [mockPayment, { ...mockPayment, id: 'payment-2' }];
      mockPaymentService.findAll.mockResolvedValue(payments);

      const result = await controller.findAll({}, mockRequest);

      expect(result).toEqual(payments);
      expect(service.findAll).toHaveBeenCalledWith('business-1', {});
    });

    it('should return payments with filters', async () => {
      const filters: PaymentFilterDto = { type: 'IN', method: 'cash' };
      const filteredPayments = [mockPayment];
      mockPaymentService.findAll.mockResolvedValue(filteredPayments);

      const result = await controller.findAll(filters, mockRequest);

      expect(result).toEqual(filteredPayments);
      expect(service.findAll).toHaveBeenCalledWith('business-1', filters);
    });

    it('should return empty array when no payments', async () => {
      mockPaymentService.findAll.mockResolvedValue([]);

      const result = await controller.findAll({}, mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single payment by id', async () => {
      mockPaymentService.findOne.mockResolvedValue(mockPayment);

      const result = await controller.findOne('payment-1', mockRequest);

      expect(result).toEqual(mockPayment);
      expect(service.findOne).toHaveBeenCalledWith('payment-1', 'business-1');
    });

    it('should throw error when payment not found', async () => {
      mockPaymentService.findOne.mockRejectedValue(new Error('Payment not found'));

      await expect(controller.findOne('nonexistent', mockRequest)).rejects.toThrow('Payment not found');
    });
  });

  describe('update', () => {
    it('should update a payment', async () => {
      const updateDto: UpdatePaymentDto = {
        description: 'Updated description',
        method: 'bank',
      };

      const updatedPayment = { ...mockPayment, ...updateDto };
      mockPaymentService.update.mockResolvedValue(updatedPayment);

      const result = await controller.update('payment-1', updateDto, mockRequest);

      expect(result).toEqual(updatedPayment);
      expect(service.update).toHaveBeenCalledWith('payment-1', 'business-1', updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a payment', async () => {
      mockPaymentService.remove.mockResolvedValue(undefined);

      await controller.remove('payment-1', mockRequest);

      expect(service.remove).toHaveBeenCalledWith('payment-1', 'business-1');
    });

    it('should throw error when removing non-existent payment', async () => {
      mockPaymentService.remove.mockRejectedValue(new Error('Payment not found'));

      await expect(controller.remove('nonexistent', mockRequest)).rejects.toThrow('Payment not found');
    });
  });
});
