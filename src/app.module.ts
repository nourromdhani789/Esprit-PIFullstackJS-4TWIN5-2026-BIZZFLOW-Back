import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TenantModule } from './tenant/tenant.module';
import { BusinessModule } from './business/business.module';
import { ProductModule } from './product/product.module';
import { InvoiceModule } from './invoice/invoice.module';
import { databaseConfig } from './config/database.config';
import { ExpenseModule } from './expense/expense.module';
import { ReportingModule } from './reporting/reporting.module';
import { StockMovementModule } from './stock-movement/stock-movement.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { CreditNoteModule } from './credit-note/credit-note.module';
import { PaymentModule } from './payment/payment.module';
import { CashModule } from './cash/cash.module';
import { StockTakeModule } from './stock-take/stock-take.module';
import { ClientModule } from './client/client.module';
import { SupplierModule } from './supplier/supplier.module';
import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notification/notification.module';
import { QuoteModule } from './quote/quote.module';
import { SalesOrderModule } from './sales-order/sales-order.module';
import { AdminDashboardModule } from './admin-dashboard/admin-dashboard.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivityModule } from './activity/activity.module';
import { DocumentProcessingModule } from './document-processing/document-processing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(databaseConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    TenantModule,
    BusinessModule,
    ProductModule,
    InvoiceModule,
    ExpenseModule,
    ReportingModule,
    StockMovementModule,
    PurchaseOrderModule,
    CreditNoteModule,
    PaymentModule,
    CashModule,
    StockTakeModule,
    ClientModule,
    SupplierModule,
    AuditModule,
    NotificationModule,
    QuoteModule,
    SalesOrderModule,
    AdminDashboardModule,
    ActivityModule,
    DocumentProcessingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
