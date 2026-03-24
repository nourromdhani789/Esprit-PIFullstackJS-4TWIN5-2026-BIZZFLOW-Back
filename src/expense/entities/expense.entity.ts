import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  receiptUrl: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: ExpenseStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  supplier: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ name: 'business_id' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
