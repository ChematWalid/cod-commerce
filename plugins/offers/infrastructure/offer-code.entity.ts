import { TenantEntity } from '@cod/plugin-tenancy';
import { CODE_MAX_LENGTH } from '@cod/shared';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { OfferEntity } from './offer.entity';
import { STORE_REQUIRED_CHECK } from './store-required';

/**
 * The `offers_code` row: a discount code of one offer, stored trimmed and upper-cased and unique in its store whatever
 * the offer (D2406). Its offer is referenced by `(businessId, storeId, offerId)` and takes it along on delete.
 */
@Entity('offers_code')
@Check('CHK_offers_code_store', STORE_REQUIRED_CHECK)
@Index(['businessId', 'storeId', 'code'], { unique: true })
@Index(['businessId', 'storeId', 'offerId'])
export class OfferCodeEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  offerId!: string;

  @Column({ type: 'varchar', length: CODE_MAX_LENGTH })
  code!: string;

  @Column({ type: 'integer', nullable: true })
  usageLimit!: number | null;

  @Column({ type: 'integer', default: 0 })
  usageCount!: number;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => OfferEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    { name: 'businessId', referencedColumnName: 'businessId' },
    { name: 'storeId', referencedColumnName: 'storeId' },
    { name: 'offerId', referencedColumnName: 'id' },
  ])
  offer?: OfferEntity;
}
