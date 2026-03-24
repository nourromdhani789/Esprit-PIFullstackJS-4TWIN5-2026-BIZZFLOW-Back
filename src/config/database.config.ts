import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Business } from '../business/entities/business.entity';
import { Invitation } from '../auth/entities/invitation.entity';
import { Product } from '../product/entities/product.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { InvoiceItem } from '../invoice/entities/invoice-item.entity';

import { Expense } from '../expense/entities/expense.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'pi_twin5_db',
  entities: [User, Tenant, Business, Invitation, Product, Invoice, InvoiceItem, Expense], 
  synchronize: true, // Enable to create/update tables automatically
  logging: true, 
};
