import { TenantEntity } from '@cod/plugin-tenancy';
import {
  type CombinesWith,
  KIND_MAX_LENGTH,
  OFFER_TITLE_MAX,
  type OfferEligibility,
  type OfferLabel,
  type OfferMethod,
  type OfferStatus,
} from '@cod/shared';
import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { ENUM_COLUMN_LENGTH } from '../domain/constants';
import { STORE_REQUIRED_CHECK } from './store-required';

/**
 * The `offers_offer` row (D2405): one offer of one store. `storeId` is required by a check (TypeORM keeps the base
 * class's nullable column, so a subclass cannot redeclare it NOT NULL), and `(businessId, storeId, id)` is unique so
 * targets and codes can reference their offer with the whole scope (composite foreign keys).
 */
@Entity('offers_offer')
@Check('CHK_offers_offer_store', STORE_REQUIRED_CHECK)
@Index(['businessId', 'storeId', 'id'], { unique: true })
@Index(['businessId', 'storeId', 'status'])
export class OfferEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: KIND_MAX_LENGTH })
  kind!: string;

  @Column({ type: 'varchar', length: ENUM_COLUMN_LENGTH })
  method!: OfferMethod;

  @Column({ type: 'varchar', length: OFFER_TITLE_MAX })
  title!: string;

  @Column({ type: 'jsonb' })
  label!: OfferLabel;

  /** Kind-specific, already parsed by the kind's schema (D2404); every kind's configuration is an object. */
  @Column({ type: 'jsonb' })
  config!: object;

  @Column({ type: 'jsonb' })
  combinesWith!: CombinesWith;

  @Column({ type: 'jsonb' })
  eligibility!: OfferEligibility;

  @Column({ type: 'integer', nullable: true })
  totalUsageLimit!: number | null;

  @Column({ type: 'integer', nullable: true })
  perBuyerLimit!: number | null;

  @Column({ type: 'varchar', length: ENUM_COLUMN_LENGTH })
  status!: OfferStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  pausedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  usageCount!: number;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
