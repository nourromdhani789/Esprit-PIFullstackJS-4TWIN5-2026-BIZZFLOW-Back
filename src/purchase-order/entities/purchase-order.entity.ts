import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type PurchaseOrderStatus = 'pending' | 'received' | 'cancelled';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  supplierId: string;

  @Column({ type: 'varchar', length: 255 })
  supplierName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: ['pending', 'received', 'cancelled'],
    default: 'pending',
  })
  status: PurchaseOrderStatus;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'date', nullable: true, name: 'received_date' })
  receivedDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'business_id' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
