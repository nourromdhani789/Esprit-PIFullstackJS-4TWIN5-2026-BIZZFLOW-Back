import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class InvoiceSchedulerService {
  private readonly logger = new Logger(InvoiceSchedulerService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkOverdueInvoices() {
    this.logger.log('Running overdue invoice check...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Find all unpaid invoices with due date in the past
      const overdueInvoices = await this.invoiceRepository.find({
        where: {
          status: InvoiceStatus.UNPAID,
          dueDate: LessThan(today),
        },
        relations: ['client'],
      });

      this.logger.log(`Found ${overdueInvoices.length} overdue invoices`);

      for (const invoice of overdueInvoices) {
        // Update invoice status to overdue
        invoice.status = InvoiceStatus.OVERDUE;
        await this.invoiceRepository.save(invoice);

        // Check if notification already exists for this invoice today
        const notificationExists = await this.notificationService.checkNotificationExists(
          invoice.businessId,
          invoice.id,
          'Invoice',
          'invoice',
          today,
        );

        if (!notificationExists) {
          // Create notification for overdue invoice
          try {
            const daysOverdue = Math.floor(
              (today.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
            );

            await this.notificationService.create(
              invoice.businessId,
              'Invoice Overdue',
              `Invoice ${invoice.invoiceNumber} for ${invoice.client?.name || 'Unknown Client'} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. Amount: TND ${Number(invoice.totalAmount).toFixed(3)}`,
              'warning',
              'invoice',
              `/invoices/${invoice.id}`,
              invoice.id,
              'Invoice',
            );

            this.logger.log(`Created overdue notification for invoice ${invoice.id}`);
          } catch (err) {
            this.logger.error(`Failed to create notification for invoice ${invoice.id}:`, err);
          }
        }
      }

      this.logger.log('Overdue invoice check completed');
    } catch (error) {
      this.logger.error('Error checking overdue invoices:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendOverdueReminders() {
    this.logger.log('Running overdue invoice reminder check...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      // Find invoices that are overdue by 7, 14, or 30 days for reminder notifications
      const overdueInvoices = await this.invoiceRepository.find({
        where: {
          status: InvoiceStatus.OVERDUE,
        },
        relations: ['client'],
      });

      for (const invoice of overdueInvoices) {
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Send reminders at 7, 14, and 30 days
        if (daysOverdue === 7 || daysOverdue === 14 || daysOverdue === 30) {
          const notificationExists = await this.notificationService.checkNotificationExists(
            invoice.businessId,
            invoice.id,
            'Invoice',
            'invoice',
            today,
          );

          if (!notificationExists) {
            try {
              await this.notificationService.create(
                invoice.businessId,
                `Invoice Overdue - ${daysOverdue} Days`,
                `Reminder: Invoice ${invoice.invoiceNumber} for ${invoice.client?.name || 'Unknown Client'} is now ${daysOverdue} days overdue. Amount: TND ${Number(invoice.totalAmount).toFixed(3)}`,
                'error',
                'invoice',
                `/invoices/${invoice.id}`,
                invoice.id,
                'Invoice',
              );

              this.logger.log(`Created ${daysOverdue}-day reminder for invoice ${invoice.id}`);
            } catch (err) {
              this.logger.error(`Failed to create reminder for invoice ${invoice.id}:`, err);
            }
          }
        }
      }

      this.logger.log('Overdue invoice reminder check completed');
    } catch (error) {
      this.logger.error('Error sending overdue reminders:', error);
    }
  }
}
