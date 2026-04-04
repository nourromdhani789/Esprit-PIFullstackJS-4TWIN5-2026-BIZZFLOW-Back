import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  userEmail: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 100 })
  entityType: string;

  @Column({ type: 'varchar', length: 255 })
  entityId: string;

  @Column({ type: 'json', nullable: true })
  details: any;

  @Column({ name: 'business_id' })
  businessId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
