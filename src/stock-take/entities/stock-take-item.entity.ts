import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { StockTake } from './stock-take.entity';

@Entity('stock_take_items')
export class StockTakeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stockTakeId: string;

  @ManyToOne(() => StockTake, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stockTakeId' })
  stockTake: StockTake;

  @Column()
  productId: string;

  @Column()
  productName: string;

  @Column({ default: 0 })
  systemQuantity: number;

  @Column({ nullable: true })
  countedQuantity?: number;

  @Column({ default: 0 })
  difference: number;

  @Column({ nullable: true })
  notes?: string;

  @Column({ default: false })
  isAdjusted: boolean;

  @Column()
  businessId: string;
}
