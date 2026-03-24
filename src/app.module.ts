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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
