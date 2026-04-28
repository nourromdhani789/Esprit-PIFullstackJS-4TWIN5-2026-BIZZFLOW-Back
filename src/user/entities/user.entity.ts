import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { Role } from '../../shared/enums/role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  isApproved: boolean;

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ nullable: true, type: 'datetime' })
  approvedAt: Date | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  emailVerificationToken: string | null;

  @Column({ nullable: true, type: 'datetime' })
  emailVerificationExpires: Date | null;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  passwordResetToken: string | null;

  @Column({ nullable: true, type: 'datetime' })
  passwordResetExpires: Date | null;

  @Column({
    type: 'enum',
    enum: Role,
  })
  roleId: Role;

  @Column({ nullable: true })
  tenantId?: string;

  @ManyToOne(() => Tenant, tenant => tenant.user)
  @JoinColumn({ name: 'tenantId' })
  tenant?: Tenant;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Face ID fields (optional, backward compatible)
  @Column({ nullable: true, type: 'text' })
  faceDescriptor?: string; // Encrypted JSON array of 128 face embeddings

  @Column({ nullable: true })
  faceEnrollmentDate?: Date;

  @Column({ default: false })
  isFaceIdEnabled: boolean;

  @Column({ nullable: true, type: 'varchar', length: 255 })
  faceIdEncryptionKey?: string; // Key identifier for encryption

  @Column({ default: 0 })
  faceLoginAttempts: number; // For rate limiting

  @Column({ nullable: true, type: 'datetime' })
  faceLoginLockoutExpires?: Date | null;

  // Methods
  login(): void {
    this.isActive = true;
  }

  logout(): void {
    // Implementation for logout logic
  }

  resetPassword(): void {
    // Implementation for password reset logic
  }
}
