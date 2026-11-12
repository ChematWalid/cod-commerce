import { TenantEntity } from '@cod/plugin-tenancy';
import type { TeamEmailLocale } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { LOCALE_MAX_LENGTH, TOKEN_HASH_HEX_LENGTH } from '../domain/constants';
import type { MemberGrant } from '../domain/member-grant';

/**
 * The `invitation` row. Only the SHA-256 hex of the token is stored (D205), unique platform-wide, and `select: false`
 * keeps it out of every generic read: only the accept lookup asks for it (D208).
 */
@Entity('invitation')
@Index(['businessId', 'memberId'])
export class InvitationEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  memberId!: string;

  @Column({ type: 'jsonb' })
  grant!: MemberGrant;

  @Index({ unique: true })
  @Column({ type: 'char', length: TOKEN_HASH_HEX_LENGTH, select: false })
  tokenHash!: string;

  @Column({ type: 'varchar', length: LOCALE_MAX_LENGTH })
  locale!: TeamEmailLocale;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz' })
  lastSentAt!: Date;

  @Column({ type: 'int' })
  resendCount!: number;

  @Column({ type: 'int' })
  invitedByAdministratorId!: number;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
