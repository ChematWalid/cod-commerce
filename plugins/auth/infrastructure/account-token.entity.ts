import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { AccountTokenPayload, AccountTokenPurpose } from '../domain/account-token';
import { ACCOUNT_TOKEN_PURPOSE_MAX_LENGTH, PENDING_EMAIL_MAX_LENGTH, SECRET_HASH_LENGTH } from '../domain/constants';

/**
 * The `account_token` row. Account-level like Vendure's `user` and `session` (D24): no business can be derived for
 * an anonymous link, so it is deliberately not a `TenantEntity`. Lookups are only by HMAC or by the active user.
 */
@Entity('account_token')
@Check('account_token_user_required', `"userId" IS NOT NULL OR "purpose" = 'oauth-ticket'`)
export class AccountTokenEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  userId!: number | null;

  @Column({ type: 'varchar', length: ACCOUNT_TOKEN_PURPOSE_MAX_LENGTH })
  purpose!: AccountTokenPurpose;

  @Index({ unique: true })
  @Column({ type: 'char', length: SECRET_HASH_LENGTH })
  tokenHash!: string;

  @Column({ type: 'char', length: SECRET_HASH_LENGTH, nullable: true })
  otpHash!: string | null;

  @Column({ type: 'int', default: 0 })
  otpAttempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  otpLockedAt!: Date | null;

  @Column({ type: 'varchar', length: PENDING_EMAIL_MAX_LENGTH, nullable: true })
  pendingEmail!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload!: AccountTokenPayload | null;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
