import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type PaymentType = 'IN' | 'OUT';
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'check' | 'transfer';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ['IN', 'OUT'],
  })
  type: PaymentType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['cash', 'bank', 'card', 'check', 'transfer'],
  })
  method: PaymentMethod;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string; // Transaction reference, check number, etc.

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'reference_id' })
  referenceId: string; // Link to invoice, expense, etc.

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'reference_type' })
  referenceType: string; // 'invoice', 'expense', 'credit_note', etc.

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ name: 'business_id' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
