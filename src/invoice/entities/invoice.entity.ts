import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Business } from '../../business/entities/business.entity';
import { InvoiceItem } from './invoice-item.entity';

export enum InvoiceStatus {
  PAID = 'paid',
  UNPAID = 'unpaid',
  OVERDUE = 'overdue',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id' })
  clientId: string;

  @Column({ name: 'client_name', nullable: true })
  clientName: string;

  @Column({ name: 'client_email', nullable: true })
  clientEmail: string;

  @Column({ name: 'business_id' })
  businessId: string;

  @ManyToOne(() => Business, business => business.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.UNPAID,
  })
  status: InvoiceStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ name: 'due_date', nullable: true })
  dueDate: Date;

  @Column({ name: 'invoice_number', nullable: true })
  invoiceNumber: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => InvoiceItem, item => item.invoice, { cascade: true, eager: true })
  items: InvoiceItem[];
}
