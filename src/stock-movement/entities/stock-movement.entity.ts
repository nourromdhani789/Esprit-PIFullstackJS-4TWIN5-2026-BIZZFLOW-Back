import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../../product/entities/product.entity';

export type StockMovementType = 'IN' | 'OUT';
export type StockMovementReason = 'purchase' | 'sale' | 'adjustment' | 'return' | 'damage' | 'initial' | 'sales_order_confirmed' | 'sales_order_cancelled';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, product => product.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    type: 'enum',
    enum: ['IN', 'OUT'],
  })
  type: StockMovementType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    type: 'enum',
    enum: ['purchase', 'sale', 'adjustment', 'return', 'damage', 'initial', 'sales_order_confirmed', 'sales_order_cancelled'],
  })
  reason: StockMovementReason;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ name: 'business_id' })
  businessId: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string; // For linking to purchase orders, invoices, etc.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
