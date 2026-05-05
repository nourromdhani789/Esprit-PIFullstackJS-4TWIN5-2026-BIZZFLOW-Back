import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification, NotificationType, NotificationCategory } from './entities/notification.entity';
import { Repository } from 'typeorm';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: Repository<Notification>;

  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilder),
  };

  const mockNotification = {
    id: 'notif-1',
    businessId: 'business-1',
    title: 'Test Notification',
    message: 'Test message',
    type: 'info' as NotificationType,
    category: 'stock' as NotificationCategory,
    isRead: false,
    link: '/test',
    entityId: 'entity-1',
    entityType: 'Test',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repository = module.get<Repository<Notification>>(getRepositoryToken(Notification));
    jest.clearAllMocks();
    queryBuilder.getMany.mockReset();
  });

  describe('create', () => {
    it('should create notification', async () => {
      mockRepository.create.mockReturnValue(mockNotification);
      mockRepository.save.mockResolvedValue(mockNotification);

      const result = await service.create(
        'business-1',
        'Test Notification',
        'Test message',
        'info',
        'stock',
        '/test',
        'entity-1',
        'Test',
      );

      expect(result).toEqual(mockNotification);
      expect(repository.create).toHaveBeenCalledWith({
        businessId: 'business-1',
        title: 'Test Notification',
        message: 'Test message',
        type: 'info',
        category: 'stock',
        isRead: false,
        link: '/test',
        entityId: 'entity-1',
        entityType: 'Test',
      });
    });
  });

  describe('findAll', () => {
    it('should return notifications for business', async () => {
      queryBuilder.getMany.mockResolvedValue([mockNotification]);

      const result = await service.findAll('business-1');

      expect(result).toEqual([mockNotification]);
    });

    it('should apply isRead filter', async () => {
      queryBuilder.getMany.mockResolvedValue([mockNotification]);

      await service.findAll('business-1', { isRead: false });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('notification.isRead = :isRead', { isRead: false });
    });

    it('should apply category filter', async () => {
      queryBuilder.getMany.mockResolvedValue([mockNotification]);

      await service.findAll('business-1', { category: 'stock' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('notification.category = :category', { category: 'stock' });
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('business-1');

      expect(result).toBe(5);
      expect(repository.count).toHaveBeenCalledWith({
        where: { businessId: 'business-1', isRead: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const readNotif = { ...mockNotification, isRead: true };
      mockRepository.findOne.mockResolvedValue(mockNotification);
      mockRepository.save.mockResolvedValue(readNotif);

      const result = await service.markAsRead('notif-1', 'business-1');

      expect(result.isRead).toBe(true);
    });

    it('should throw when notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('notif-1', 'business-1')).rejects.toThrow('Notification not found');
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications', async () => {
      mockRepository.update.mockResolvedValue({ affected: 5 });

      await service.markAllAsRead('business-1');

      expect(repository.update).toHaveBeenCalledWith(
        { businessId: 'business-1', isRead: false },
        { isRead: true },
      );
    });
  });

  describe('delete', () => {
    it('should delete notification', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.delete('notif-1', 'business-1');

      expect(repository.remove).toHaveBeenCalledWith(mockNotification);
    });

    it('should throw when notification not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('notif-1', 'business-1')).rejects.toThrow('Notification not found');
    });
  });

  describe('checkNotificationExists', () => {
    it('should return true when notification exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockNotification);
      const date = new Date();

      const result = await service.checkNotificationExists('business-1', 'entity-1', 'Test', 'stock', date);

      expect(result).toBe(true);
    });

    it('should return false when notification does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const date = new Date();

      const result = await service.checkNotificationExists('business-1', 'entity-1', 'Test', 'stock', date);

      expect(result).toBe(false);
    });
  });
});
