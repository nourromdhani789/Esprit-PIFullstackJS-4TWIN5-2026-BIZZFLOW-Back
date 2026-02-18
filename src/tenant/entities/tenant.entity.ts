import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { TenantStatus } from '../../shared/enums/tenant-status.enum';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  subdomain: string;

  @Column({
    type: 'enum',
    enum: TenantStatus,
    default: TenantStatus.ACTIVE,
  })
  status: TenantStatus;

  @OneToOne(() => User, user => user.tenant)
  @JoinColumn({ name: 'tenantId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Methods
  provision(): void {
    this.status = TenantStatus.ACTIVE;
  }

  suspend(): void {
    this.status = TenantStatus.SUSPENDED;
  }

  activate(): void {
    this.status = TenantStatus.ACTIVE;
  }
}
