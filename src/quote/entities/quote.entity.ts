import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { Client } from '../../client/entities/client.entity';
import { QuoteItem } from './quote-item.entity';

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @ManyToOne(() => Client, client => client.quotes, { eager: true })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'business_id' })
  businessId: string;

  @ManyToOne(() => Business, business => business.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({
    type: 'enum',
    enum: QuoteStatus,
    default: QuoteStatus.DRAFT,
  })
  status: QuoteStatus;

  @Column({ name: 'quote_number', nullable: true })
  quoteNumber: string;

  @Column({ name: 'issue_date' })
  issueDate: Date;

  @Column({ name: 'expiry_date' })
  expiryDate: Date;

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

  @Column({ name: 'converted_to_sales_order_id', nullable: true })
  convertedToSalesOrderId: string;

  @Column({ name: 'converted_to_invoice_id', nullable: true })
  convertedToInvoiceId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => QuoteItem, item => item.quote, { cascade: true, eager: true })
  items: QuoteItem[];
}
