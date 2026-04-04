import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from '../../invoice/entities/invoice.entity';

@Entity('credit_notes')
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  clientName: string;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  amount: number;

  @Column({ type: 'enum', enum: ['returned_goods', 'pricing_error', 'product_expired_or_damaged', 'service_not_delivered', 'partial_refund', 'other'], default: 'other' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  reasonDetails: string; // Additional details when reason is 'other'

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string; // Invoice reference or other

  @Column({ type: 'uuid', nullable: true, name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'enum', enum: ['draft', 'approved', 'applied', 'refunded', 'cancelled'], default: 'draft' })
  status: string; // draft, approved, applied, refunded, cancelled

  @Column({ name: 'business_id' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
