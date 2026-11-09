import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { BusinessStatus } from '../domain/business';
import { NAME_MAX_LENGTH, STATE_COLUMN_MAX_LENGTH } from '../domain/constants';

/** The `business` row, the tenant root: it is not a `TenantEntity` because it is what tenants are scoped by. */
@Entity('business')
export class BusinessEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: NAME_MAX_LENGTH })
  name!: string;

  @Column({ type: 'int', nullable: true })
  logoAssetId!: number | null;

  @Column({ type: 'jsonb', default: {} })
  onboardingState!: Record<string, unknown>;

  @Column({ type: 'int', nullable: true })
  ownerAdministratorId!: number | null;

  @Column({ type: 'int' })
  sellerId!: number;

  @Column({ type: 'int', nullable: true })
  ownerRoleId!: number | null;

  @Column({ type: 'bigint', nullable: true })
  planId!: string | null;

  @Column({ type: 'varchar', length: STATE_COLUMN_MAX_LENGTH })
  status!: BusinessStatus;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
