import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SalesOrder } from './sales-order.entity';
import { Product } from '../../product/entities/product.entity';

@Entity('sales_order_items')
export class SalesOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sales_order_id' })
  salesOrderId: string;

  @ManyToOne(() => SalesOrder, salesOrder => salesOrder.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sales_order_id' })
  salesOrder: SalesOrder;

  @Column({ name: 'product_id', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 3 })
  unitPrice: number;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'total', type: 'decimal', precision: 10, scale: 3, default: 0 })
  total: number;
}
