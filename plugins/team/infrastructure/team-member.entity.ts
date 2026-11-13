import { TenantEntity } from '@cod/plugin-tenancy';
import { MEMBER_NAME_MAX_LENGTH, type MemberStatus } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { EMAIL_MAX_LENGTH, SHORT_KIND_MAX_LENGTH } from '../domain/constants';
import type { MemberGrant } from '../domain/member-grant';

/**
 * The `team_member` row (D200, D204). One live member per address and per administrator in a business: the partial
 * unique indexes leave removed members out, so a removed member's address can be invited again. Roles and stores
 * live in rbac; only a deactivated member's former grant is kept here, in `suspendedAccess`.
 */
@Entity('team_member')
@Index(['businessId', 'emailKey'], { unique: true, where: '"removedAt" IS NULL' })
@Index(['businessId', 'administratorId'], { unique: true, where: '"administratorId" IS NOT NULL' })
@Index(['businessId', 'status', 'id'])
export class TeamMemberEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'int', nullable: true })
  administratorId!: number | null;

  @Column({ type: 'varchar', length: EMAIL_MAX_LENGTH })
  email!: string;

  @Column({ type: 'varchar', length: EMAIL_MAX_LENGTH })
  emailKey!: string;

  @Column({ type: 'varchar', length: MEMBER_NAME_MAX_LENGTH, nullable: true })
  firstName!: string | null;

  @Column({ type: 'varchar', length: MEMBER_NAME_MAX_LENGTH, nullable: true })
  lastName!: string | null;

  @Column({ type: 'varchar', length: SHORT_KIND_MAX_LENGTH })
  status!: MemberStatus;

  @Column({ type: 'jsonb', nullable: true })
  suspendedAccess!: MemberGrant | null;

  @Column({ type: 'bigint', array: true })
  commissionConfigIds!: string[];

  @Column({ type: 'int' })
  baseSalary!: number;

  @Column({ type: 'int', nullable: true })
  maxOpenOrders!: number | null;

  @Column({ type: 'boolean' })
  receivingOrders!: boolean;

  @Column({ type: 'int', nullable: true })
  invitedByAdministratorId!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  joinedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  removedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
