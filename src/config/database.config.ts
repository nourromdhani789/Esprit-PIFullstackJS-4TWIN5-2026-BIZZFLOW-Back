import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { Business } from '../business/entities/business.entity';
import { Invitation } from '../auth/entities/invitation.entity';
import { Product } from '../product/entities/product.entity';
import { Invoice } from '../invoice/entities/invoice.entity';
import { InvoiceItem } from '../invoice/entities/invoice-item.entity';

import { Expense } from '../expense/entities/expense.entity';
import { StockMovement } from '../stock-movement/entities/stock-movement.entity';
import { StockTake } from '../stock-take/entities/stock-take.entity';
import { StockTakeItem } from '../stock-take/entities/stock-take-item.entity';
import { PurchaseOrder } from '../purchase-order/entities/purchase-order.entity';
import { CreditNote } from '../credit-note/entities/credit-note.entity';
import { Cash } from '../cash/entities/cash.entity';
import { Payment } from '../payment/entities/payment.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'pi_twin5_db',
  entities: [User, Tenant, Business, Invitation, Product, Invoice, InvoiceItem, Expense, StockMovement, StockTake, StockTakeItem, PurchaseOrder, CreditNote, Cash, Payment], 
  synchronize: true, // Enable to create/update tables automatically
  logging: true, 
};
