import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { InvitationStatus } from '../../shared/enums/invitation-status.enum';
import { Role } from '../../shared/enums/role.enum';

@Entity('invitations')
@Index(['email', 'status'])
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ unique: true })
  token: string;

  @Column()
  invitedBy: string; // User ID of the inviter (Business Owner)

  @Column()
  tenantId: string; // Pre-assigned tenant for data isolation

  @Column({
    type: 'enum',
    enum: Role,
  })
  roleId: Role; // Role assigned (ACCOUNTANT, BUSINESS_ADMIN, TEAM_MEMBER)

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ nullable: true })
  acceptedAt: Date;

  @Column({ nullable: true })
  acceptedByUserId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper method to check if invitation is expired
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  // Helper method to accept invitation
  accept(userId: string): void {
    this.status = InvitationStatus.ACCEPTED;
    this.acceptedAt = new Date();
    this.acceptedByUserId = userId;
  }

  // Helper method to revoke invitation
  revoke(): void {
    this.status = InvitationStatus.REVOKED;
  }
}
