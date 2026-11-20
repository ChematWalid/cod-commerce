import { TenantEntity } from '@cod/plugin-tenancy';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ENUM_COLUMN_LENGTH } from '../domain/constants';
import { CORE_ID_COLUMN } from './core-id.column';
import { OfferEntity } from './offer.entity';
import { STORE_REQUIRED_CHECK, TARGET_REF_TYPE_CHECK, TARGET_ROLE_CHECK } from './store-required';

/**
 * The `offers_offer_target` row: a variant, product or collection (a Vendure core id) an offer counts (D2405, D2410).
 * Its offer is referenced by `(businessId, storeId, offerId)`, so a target can never hang off another store's offer,
 * and goes with it on delete.
 */
@Entity('offers_offer_target')
@Check('CHK_offers_offer_target_store', STORE_REQUIRED_CHECK)
@Check('CHK_offers_offer_target_ref_type', TARGET_REF_TYPE_CHECK)
@Check('CHK_offers_offer_target_role', TARGET_ROLE_CHECK)
@Index(['businessId', 'storeId', 'offerId', 'position'])
export class OfferTargetEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  offerId!: string;

  @Column({ type: 'varchar', length: ENUM_COLUMN_LENGTH })
  role!: string;

  @Column({ type: 'varchar', length: ENUM_COLUMN_LENGTH })
  refType!: string;

  @Column(CORE_ID_COLUMN)
  refId!: string;

  @Column({ type: 'integer' })
  position!: number;

  @ManyToOne(() => OfferEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    { name: 'businessId', referencedColumnName: 'businessId' },
    { name: 'storeId', referencedColumnName: 'storeId' },
    { name: 'offerId', referencedColumnName: 'id' },
  ])
  offer?: OfferEntity;
}
