import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { SEARCH_SYNONYM_MAX_LENGTH } from '../domain/constants';

/** The table of the business search synonyms (ADR 0014). */
export const STOREFRONT_SEARCH_SYNONYM_TABLE = 'storefront_search_synonym';

/**
 * One search synonym of a business: `term` and `expansion` in search normal form, applied in both directions to every
 * store of the business. The business's first search seeds the Darija list. Per business, so `storeId` stays null.
 */
@Entity(STOREFRONT_SEARCH_SYNONYM_TABLE)
@Index('storefront_search_synonym_pair', ['businessId', 'term', 'expansion'], { unique: true })
export class StorefrontSearchSynonymEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: SEARCH_SYNONYM_MAX_LENGTH })
  term!: string;

  @Column({ type: 'varchar', length: SEARCH_SYNONYM_MAX_LENGTH })
  expansion!: string;
}
