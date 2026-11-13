import { Check, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn, Unique, UpdateDateColumn } from 'typeorm';
import { FLAG_KEY_MAX_LENGTH, OVERRIDE_SCOPE_ID_MAX_LENGTH, OVERRIDE_SCOPE_MAX_LENGTH } from '../domain/constants';
import type { OverrideScope } from '../domain/snapshot';
import { FeatureFlagEntity } from './feature-flag.entity';

/**
 * The `feature_flag_override` row (D116): one answer for a plan, a business or a store. A platform table like its
 * flag (D108); `scopeId` names the target and is checked against the tenant tables when staff set it.
 */
@Entity('feature_flag_override')
@Unique('UQ_feature_flag_override_target', ['flagKey', 'scope', 'scopeId'])
@Check('feature_flag_override_scope', `"scope" IN ('plan', 'business', 'store')`)
export class FeatureFlagOverrideEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: FLAG_KEY_MAX_LENGTH })
  flagKey!: string;

  @ManyToOne(() => FeatureFlagEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flagKey' })
  flag?: FeatureFlagEntity;

  @Column({ type: 'varchar', length: OVERRIDE_SCOPE_MAX_LENGTH })
  scope!: OverrideScope;

  @Column({ type: 'varchar', length: OVERRIDE_SCOPE_ID_MAX_LENGTH })
  scopeId!: string;

  @Column({ type: 'boolean' })
  enabled!: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
