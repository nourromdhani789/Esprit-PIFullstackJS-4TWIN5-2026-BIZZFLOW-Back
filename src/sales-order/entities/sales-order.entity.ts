import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { Client } from '../../client/entities/client.entity';
import { SalesOrderItem } from './sales-order-item.entity';

export enum SalesOrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

@Entity('sales_orders')
export class SalesOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Client, client => client.salesOrders, { eager: true })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'business_id' })
  businessId: string;

  @ManyToOne(() => Business, business => business.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({
    type: 'enum',
    enum: SalesOrderStatus,
    default: SalesOrderStatus.DRAFT,
  })
  status: SalesOrderStatus;

  @Column({ name: 'sales_order_number', nullable: true })
  salesOrderNumber: string;

  @Column({ name: 'issue_date' })
  issueDate: Date;

  @Column({ name: 'expected_delivery_date', nullable: true })
  expectedDeliveryDate: Date;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 3, default: 0 })
  totalAmount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 3, default: 0 })
  taxAmount: number;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 3, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ name: 'source_quote_id', nullable: true })
  sourceQuoteId: string;

  @Column({ name: 'converted_to_invoice_id', nullable: true })
  convertedToInvoiceId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => SalesOrderItem, item => item.salesOrder, { cascade: true, eager: true })
  items: SalesOrderItem[];
}
