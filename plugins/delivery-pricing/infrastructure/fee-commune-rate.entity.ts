import { TenantEntity } from '@cod/plugin-tenancy';
import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { FeeGroupEntity } from './fee-group.entity';
import { PROVINCE_CODE_LENGTH, STORE_REQUIRED_CHECK } from './store-required';

/**
 * The `delivery_fee_commune_rate` row: the sparse commune layer of a fee group (D3125); every price and switch may be
 * `null`, which inherits the wilaya. No database FK to `geo_town` (another plugin's table): the commune is checked
 * against geo's town directory on write. Its group is referenced with the whole scope and goes with it on delete.
 */
@Entity('delivery_fee_commune_rate')
@Check('CHK_delivery_fee_commune_rate_store', STORE_REQUIRED_CHECK)
@Index(['businessId', 'storeId', 'groupId', 'provinceCode'])
export class FeeCommuneRateEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  groupId!: string;

  /** The commune's ONS code (D3104). */
  @PrimaryColumn({ type: 'integer' })
  codeOns!: number;

  @Column({ type: 'varchar', length: PROVINCE_CODE_LENGTH })
  provinceCode!: string;

  @Column({ type: 'integer', nullable: true })
  baseHome!: number | null;

  @Column({ type: 'integer', nullable: true })
  baseDesk!: number | null;

  @Column({ type: 'integer', nullable: true })
  overrideHome!: number | null;

  @Column({ type: 'integer', nullable: true })
  overrideDesk!: number | null;

  @Column({ type: 'boolean', nullable: true })
  deliveryEnabled!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  deskEnabled!: boolean | null;

  @ManyToOne(() => FeeGroupEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    { name: 'businessId', referencedColumnName: 'businessId' },
    { name: 'storeId', referencedColumnName: 'storeId' },
    { name: 'groupId', referencedColumnName: 'id' },
  ])
  group?: FeeGroupEntity;
}
