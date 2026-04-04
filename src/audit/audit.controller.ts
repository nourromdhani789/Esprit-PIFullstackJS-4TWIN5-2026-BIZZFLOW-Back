import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuditService, AuditLogFilters } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuditLog } from './entities/audit-log.entity';

export interface ActivityResponse {
  id: string;
  description: string;
  entityType: string;
  entityId: string;
  userEmail: string;
  icon: string;
  link: string;
  createdAt: Date;
}

@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<AuditLog[]> {
    const filters: AuditLogFilters = {};
    
    if (entityType) filters.entityType = entityType;
    if (entityId) filters.entityId = entityId;
    if (userId) filters.userId = userId;
    if (dateFrom) filters.dateFrom = new Date(dateFrom);
    if (dateTo) filters.dateTo = new Date(dateTo);

    return this.auditService.findAll(req.user.businessId, filters);
  }

  @Get('dashboard/activity')
  async getDashboardActivity(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<{ activities: ActivityResponse[]; total: number; hasMore: boolean }> {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const pageNum = page ? parseInt(page, 10) : 1;
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await this.auditService.findAllPaginated(
      req.user.businessId,
      limitNum,
      skip,
    );

    const activities: ActivityResponse[] = logs.map((log) => ({
      id: log.id,
      description: this.formatDescription(log),
      entityType: log.entityType,
      entityId: log.entityId,
      userEmail: log.userEmail,
      icon: this.getIconForEntity(log.entityType, log.action),
      link: this.getLinkForEntity(log.entityType, log.entityId),
      createdAt: log.createdAt,
    }));

    return {
      activities,
      total,
      hasMore: skip + logs.length < total,
    };
  }

  private formatDescription(log: AuditLog): string {
    const details = log.details || {};
    
    switch (log.entityType) {
      case 'Invoice':
        if (log.action === 'created_invoice') {
          return `Invoice ${details.invoiceNumber || ''} created for ${details.clientName || 'Unknown'}`;
        }
        if (log.action.includes('status') && details.newStatus) {
          return `Invoice ${details.invoiceNumber || ''} marked as ${details.newStatus}`;
        }
        if (log.action === 'updated_invoice') {
          return `Invoice ${details.invoiceNumber || ''} updated`;
        }
        if (log.action === 'deleted_invoice') {
          return `Invoice ${details.invoiceNumber || ''} deleted`;
        }
        return `Invoice activity: ${log.action}`;

      case 'Expense':
        if (log.action === 'created_expense') {
          return `Expense of TND ${Number(details.amount || 0).toFixed(3)} submitted`;
        }
        if (log.action === 'approved_expense') {
          return `Expense of TND ${Number(details.amount || 0).toFixed(3)} approved`;
        }
        if (log.action === 'rejected_expense') {
          return `Expense of TND ${Number(details.amount || 0).toFixed(3)} rejected`;
        }
        if (log.action === 'updated_expense') {
          return `Expense of TND ${Number(details.amount || 0).toFixed(3)} updated`;
        }
        if (log.action === 'deleted_expense') {
          return `Expense of TND ${Number(details.amount || 0).toFixed(3)} deleted`;
        }
        return `Expense activity: ${log.action}`;

      case 'PurchaseOrder':
        if (log.action === 'created_purchase_order') {
          return `Purchase Order created for ${details.supplierName || 'Unknown'}`;
        }
        if (log.action === 'received_purchase_order') {
          return `Purchase Order from ${details.supplierName || 'Unknown'} received`;
        }
        if (log.action === 'cancelled_purchase_order') {
          return `Purchase Order from ${details.supplierName || 'Unknown'} cancelled`;
        }
        if (log.action === 'deleted_purchase_order') {
          return `Purchase Order from ${details.supplierName || 'Unknown'} deleted`;
        }
        return `Purchase Order activity: ${log.action}`;

      case 'CreditNote':
        if (log.action === 'created_credit_note') {
          return `Credit Note of TND ${Number(details.amount || 0).toFixed(3)} created`;
        }
        if (log.action === 'approved_credit_note') {
          return `Credit Note for ${details.clientName || 'Unknown'} approved`;
        }
        if (log.action === 'applied_credit_note') {
          return `Credit Note applied to invoice for ${details.clientName || 'Unknown'}`;
        }
        if (log.action === 'refunded_credit_note') {
          return `Credit Note of TND ${Number(details.amount || 0).toFixed(3)} refunded to ${details.clientName || 'Unknown'}`;
        }
        if (log.action === 'cancelled_credit_note') {
          return `Credit Note for ${details.clientName || 'Unknown'} cancelled`;
        }
        if (log.action === 'deleted_credit_note') {
          return `Credit Note deleted`;
        }
        return `Credit Note activity: ${log.action}`;

      case 'Product':
        if (log.action === 'created_product') {
          return `New product "${details.name || 'Unknown'}" added to catalog`;
        }
        if (log.action === 'updated_product') {
          return `Product "${details.name || 'Unknown'}" updated`;
        }
        if (log.action === 'deleted_product') {
          return `Product "${details.name || 'Unknown'}" deleted`;
        }
        return `Product activity: ${log.action}`;

      case 'Client':
        if (log.action === 'created_client') {
          return `New client "${details.name || 'Unknown'}" added`;
        }
        if (log.action === 'updated_client') {
          return `Client "${details.name || 'Unknown'}" updated`;
        }
        if (log.action === 'deleted_client') {
          return `Client "${details.name || 'Unknown'}" deleted`;
        }
        return `Client activity: ${log.action}`;

      case 'Supplier':
        if (log.action === 'created_supplier') {
          return `New supplier "${details.name || 'Unknown'}" added`;
        }
        if (log.action === 'updated_supplier') {
          return `Supplier "${details.name || 'Unknown'}" updated`;
        }
        if (log.action === 'deleted_supplier') {
          return `Supplier "${details.name || 'Unknown'}" deleted`;
        }
        return `Supplier activity: ${log.action}`;

      case 'StockTake':
        if (log.action === 'started_stock_take') {
          return `Stock Take "${details.name || 'Unknown'}" started`;
        }
        if (log.action === 'completed_stock_take') {
          return `Stock Take "${details.name || 'Unknown'}" completed`;
        }
        if (log.action === 'created_stock_take') {
          return `Stock Take "${details.name || 'Unknown'}" created`;
        }
        if (log.action === 'cancelled_stock_take') {
          return `Stock Take "${details.name || 'Unknown'}" cancelled`;
        }
        if (log.action === 'deleted_stock_take') {
          return `Stock Take "${details.name || 'Unknown'}" deleted`;
        }
        return `Stock Take activity: ${log.action}`;

      case 'Payment':
        if (log.action === 'recorded_payment_in') {
          return `Payment of TND ${Number(details.amount || 0).toFixed(3)} received`;
        }
        if (log.action === 'recorded_payment_out') {
          return `Payment of TND ${Number(details.amount || 0).toFixed(3)} sent`;
        }
        return `Payment activity: ${log.action}`;

      default:
        return `${log.entityType} ${log.action}`;
    }
  }

  private getIconForEntity(entityType: string, action: string): string {
    const icons: Record<string, string> = {
      Invoice: '📄',
      Expense: '💸',
      PurchaseOrder: '📦',
      CreditNote: '🧾',
      Product: '🏷️',
      Client: '👤',
      Supplier: '🏭',
      StockTake: '📊',
      Payment: '💰',
    };
    return icons[entityType] || '📝';
  }

  private getLinkForEntity(entityType: string, entityId: string): string {
    const routes: Record<string, string> = {
      Invoice: `/invoices/${entityId}`,
      Expense: `/expenses/${entityId}`,
      PurchaseOrder: `/purchase-orders/${entityId}`,
      CreditNote: `/credit-notes/${entityId}`,
      Product: `/products/${entityId}`,
      Client: `/clients/${entityId}`,
      Supplier: `/suppliers/${entityId}`,
      StockTake: `/stock-takes/${entityId}`,
      Payment: `/payments/${entityId}`,
    };
    return routes[entityType] || '#';
  }
}
