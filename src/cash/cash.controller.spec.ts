import { Test, TestingModule } from '@nestjs/testing';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('CashController', () => {
  let controller: CashController;
  let service: CashService;

  const mockCashService = {
    getBalance: jest.fn(),
    getCashDetails: jest.fn(),
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
      controllers: [CashController],
      providers: [
        {
          provide: CashService,
          useValue: mockCashService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CashController>(CashController);
    service = module.get<CashService>(CashService);

    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return cash balance', async () => {
      mockCashService.getBalance.mockResolvedValue(1500);

      const result = await controller.getBalance(mockRequest);

      expect(result).toBe(1500);
      expect(service.getBalance).toHaveBeenCalledWith('business-1');
    });

    it('should return 0 when no cash record exists', async () => {
      mockCashService.getBalance.mockResolvedValue(0);

      const result = await controller.getBalance(mockRequest);

      expect(result).toBe(0);
    });
  });

  describe('getCashDetails', () => {
    it('should return cash details', async () => {
      const cashDetails = {
        id: 'cash-1',
        businessId: 'business-1',
        currentBalance: 1500,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCashService.getCashDetails.mockResolvedValue(cashDetails);

      const result = await controller.getCashDetails(mockRequest);

      expect(result).toEqual(cashDetails);
      expect(service.getCashDetails).toHaveBeenCalledWith('business-1');
    });
  });
});
