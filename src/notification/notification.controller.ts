import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import type { NotificationCategory } from './entities/notification.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('isRead') isRead?: string,
    @Query('category') category?: NotificationCategory,
    @Query('limit') limit?: string,
  ) {
    const businessId = req.user.businessId;
    const filters = {
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      category,
    };
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.notificationService.findAll(businessId, filters, parsedLimit);
  }

  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const businessId = req.user.businessId;
    const count = await this.notificationService.getUnreadCount(businessId);
    return { count };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req) {
    const businessId = req.user.businessId;
    return this.notificationService.markAsRead(id, businessId);
  }

  @Patch('mark-all-read')
  async markAllAsRead(@Request() req) {
    const businessId = req.user.businessId;
    await this.notificationService.markAllAsRead(businessId);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    const businessId = req.user.businessId;
    await this.notificationService.delete(id, businessId);
    return { message: 'Notification deleted' };
  }
}
