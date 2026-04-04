import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type NotificationType = 'warning' | 'info' | 'success' | 'error';
export type NotificationCategory =
  | 'invoice'
  | 'expense'
  | 'stock'
  | 'purchase_order'
  | 'credit_note'
  | 'payment'
  | 'quote'
  | 'sales_order';

@Entity('notifications')
@Index(['businessId', 'isRead'])
@Index(['businessId', 'category'])
@Index(['businessId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  businessId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: ['warning', 'info', 'success', 'error'],
    default: 'info',
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: ['invoice', 'expense', 'stock', 'purchase_order', 'credit_note', 'payment', 'quote', 'sales_order'],
  })
  category: NotificationCategory;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  link: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  entityId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType: string;

  @CreateDateColumn()
  createdAt: Date;
}
