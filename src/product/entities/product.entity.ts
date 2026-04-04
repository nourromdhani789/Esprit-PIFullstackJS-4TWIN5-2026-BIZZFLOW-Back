import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Business } from '../../business/entities/business.entity';

export type ProductUsedFor = 'sales' | 'purchases' | 'both';
export type ProductType = 'storable' | 'consumable' | 'service';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'business_id' })
  businessId: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'int', default: 0, name: 'minimum_stock' })
  minimumStock: number;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'enum', enum: ['sales', 'purchases', 'both'], default: 'both', name: 'used_for' })
  usedFor: ProductUsedFor;

  @Column({ type: 'enum', enum: ['storable', 'consumable', 'service'], default: 'storable', name: 'product_type' })
  productType: ProductType;

  @ManyToOne(() => Business, business => business.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
