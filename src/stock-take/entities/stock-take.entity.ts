import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type StockTakeStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';

@Entity('stock_takes')
export class StockTake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'in_progress', 'completed', 'cancelled'],
    default: 'draft',
  })
  status: StockTakeStatus;

  @Column({ type: 'date', nullable: true })
  countDate?: Date;

  @Column({ default: 0 })
  totalProducts: number;

  @Column({ default: 0 })
  productsCounted: number;

  @Column({ default: 0 })
  discrepancies: number;

  @Column()
  businessId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
