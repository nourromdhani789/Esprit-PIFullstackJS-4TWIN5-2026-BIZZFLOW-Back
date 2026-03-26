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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot(databaseConfig),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
