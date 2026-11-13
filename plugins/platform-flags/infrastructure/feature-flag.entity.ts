import { Check, Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { FLAG_DESCRIPTION_MAX_LENGTH, FLAG_KEY_MAX_LENGTH, UPDATED_BY_MAX_LENGTH } from '../domain/constants';

/**
 * The `feature_flag` row (D116): staff-managed configuration, deliberately not a `TenantEntity` (D108). Merchants never
 * read or write it, and a business or store id in its overrides is a target, not an owner.
 */
@Entity('feature_flag')
@Check('feature_flag_rollout_range', '"rolloutPercent" >= 0 AND "rolloutPercent" <= 100')
export class FeatureFlagEntity {
  @PrimaryColumn({ type: 'varchar', length: FLAG_KEY_MAX_LENGTH })
  key!: string;

  @Column({ type: 'varchar', length: FLAG_DESCRIPTION_MAX_LENGTH })
  description!: string;

  @Column({ type: 'boolean' })
  defaultEnabled!: boolean;

  @Column({ type: 'int' })
  rolloutPercent!: number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  /** The staff member of the last change; null for a seed nobody changed. */
  @Column({ type: 'varchar', length: UPDATED_BY_MAX_LENGTH, nullable: true })
  updatedBy!: string | null;
}
