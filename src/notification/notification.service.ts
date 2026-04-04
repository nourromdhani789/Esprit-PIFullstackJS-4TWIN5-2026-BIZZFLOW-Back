import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Notification, NotificationType, NotificationCategory } from './entities/notification.entity';

export interface NotificationFilters {
  isRead?: boolean;
  category?: NotificationCategory;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(
    businessId: string,
    title: string,
    message: string,
    type: NotificationType,
    category: NotificationCategory,
    link?: string,
    entityId?: string,
    entityType?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      businessId,
      title,
      message,
      type,
      category,
      link,
      entityId,
      entityType,
      isRead: false,
    });

    return await this.notificationRepository.save(notification);
  }

  async findAll(
    businessId: string,
    filters?: NotificationFilters,
    limit: number = 20,
  ): Promise<Notification[]> {
    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.businessId = :businessId', { businessId })
      .orderBy('notification.createdAt', 'DESC')
      .limit(limit);

    if (filters?.isRead !== undefined) {
      query.andWhere('notification.isRead = :isRead', { isRead: filters.isRead });
    }

    if (filters?.category) {
      query.andWhere('notification.category = :category', { category: filters.category });
    }

    return await query.getMany();
  }

  async getUnreadCount(businessId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { businessId, isRead: false },
    });
  }

  async markAsRead(id: string, businessId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, businessId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    notification.isRead = true;
    return await this.notificationRepository.save(notification);
  }

  async markAllAsRead(businessId: string): Promise<void> {
    await this.notificationRepository.update(
      { businessId, isRead: false },
      { isRead: true },
    );
  }

  async delete(id: string, businessId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id, businessId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    await this.notificationRepository.remove(notification);
  }

  async checkNotificationExists(
    businessId: string,
    entityId: string,
    entityType: string,
    category: NotificationCategory,
    date: Date,
  ): Promise<boolean> {
    const notification = await this.notificationRepository.findOne({
      where: {
        businessId,
        entityId,
        entityType,
        category,
        createdAt: LessThan(date),
      },
    });

    return !!notification;
  }
}
