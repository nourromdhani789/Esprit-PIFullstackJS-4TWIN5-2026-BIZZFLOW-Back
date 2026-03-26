import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('credit_notes')
export class CreditNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  clientName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string; // Invoice reference or other

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string; // active, used, cancelled

  @Column({ name: 'business_id' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
