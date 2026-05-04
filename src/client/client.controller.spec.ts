import { Test, TestingModule } from '@nestjs/testing';
import { ClientController } from './client.controller';
import { ClientService } from './client.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('ClientController', () => {
  let controller: ClientController;
  let service: ClientService;

  const mockClientService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getProfile: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockClient = {
    id: 'client-1',
    name: 'Test Client',
    email: 'client@test.com',
    phone: '+1234567890',
    address: '123 Test St',
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
      controllers: [ClientController],
      providers: [
        {
          provide: ClientService,
          useValue: mockClientService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClientController>(ClientController);
    service = module.get<ClientService>(ClientService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new client', async () => {
      const createDto: CreateClientDto = {
        name: 'New Client',
        email: 'new@client.com',
        phone: '+1234567890',
        address: '456 New St',
      };

      mockClientService.create.mockResolvedValue(mockClient);

      const result = await controller.create(createDto, mockRequest);

      expect(result).toEqual(mockClient);
      expect(service.create).toHaveBeenCalledWith('business-1', createDto);
    });

    it('should create client with minimal data', async () => {
      const minimalDto: CreateClientDto = {
        name: 'Minimal Client',
      };

      const minimalClient = { ...mockClient, ...minimalDto };
      mockClientService.create.mockResolvedValue(minimalClient);

      const result = await controller.create(minimalDto, mockRequest);

      expect(result.name).toBe('Minimal Client');
    });
  });

  describe('findAll', () => {
    it('should return all clients for business', async () => {
      const clients = [mockClient, { ...mockClient, id: 'client-2', name: 'Client Two' }];
      mockClientService.findAll.mockResolvedValue(clients);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual(clients);
      expect(service.findAll).toHaveBeenCalledWith('business-1');
    });

    it('should return empty array when no clients', async () => {
      mockClientService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single client by id', async () => {
      mockClientService.findOne.mockResolvedValue(mockClient);

      const result = await controller.findOne('client-1', mockRequest);

      expect(result).toEqual(mockClient);
      expect(service.findOne).toHaveBeenCalledWith('client-1', 'business-1');
    });

    it('should throw error when client not found', async () => {
      mockClientService.findOne.mockRejectedValue(new Error('Client not found'));

      await expect(controller.findOne('nonexistent', mockRequest)).rejects.toThrow('Client not found');
    });
  });

  describe('getProfile', () => {
    it('should return client profile with stats', async () => {
      const profile = {
        client: mockClient,
        stats: {
          totalInvoiced: 5000,
          totalPaid: 3000,
          outstandingBalance: 2000,
          invoiceCount: 5,
        },
        invoices: [],
        payments: [],
      };
      mockClientService.getProfile.mockResolvedValue(profile);

      const result = await controller.getProfile('client-1', mockRequest);

      expect(result).toEqual(profile);
      expect(service.getProfile).toHaveBeenCalledWith('client-1', 'business-1');
    });
  });

  describe('update', () => {
    it('should update a client', async () => {
      const updateDto: UpdateClientDto = {
        name: 'Updated Name',
        email: 'updated@client.com',
      };

      const updatedClient = { ...mockClient, ...updateDto };
      mockClientService.update.mockResolvedValue(updatedClient);

      const result = await controller.update('client-1', updateDto, mockRequest);

      expect(result).toEqual(updatedClient);
      expect(service.update).toHaveBeenCalledWith('client-1', 'business-1', updateDto);
    });

    it('should update client with partial data', async () => {
      const partialUpdate: UpdateClientDto = {
        phone: '+9999999999',
      };

      const updatedClient = { ...mockClient, phone: '+9999999999' };
      mockClientService.update.mockResolvedValue(updatedClient);

      const result = await controller.update('client-1', partialUpdate, mockRequest);

      expect(result.phone).toBe('+9999999999');
    });
  });

  describe('remove', () => {
    it('should remove a client', async () => {
      mockClientService.remove.mockResolvedValue(undefined);

      await controller.remove('client-1', mockRequest);

      expect(service.remove).toHaveBeenCalledWith('client-1', 'business-1');
    });

    it('should throw error when removing non-existent client', async () => {
      mockClientService.remove.mockRejectedValue(new Error('Client not found'));

      await expect(controller.remove('nonexistent', mockRequest)).rejects.toThrow('Client not found');
    });
  });
});
