import type { WilayaCode } from '@cod/shared';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { PLACE_NAME_MAX_LENGTH, WILAYA_CODE_LENGTH } from '../domain/constants';

/**
 * The `geo_province` row: one wilaya of law 26-06 (D3123). Global reference data, not a tenant table (D3103): no
 * `businessId`, read by every store, written only by the seed.
 */
@Entity('geo_province')
export class GeoProvinceEntity {
  @PrimaryColumn({ type: 'varchar', length: WILAYA_CODE_LENGTH })
  code!: WilayaCode;

  @Column({ type: 'varchar', length: PLACE_NAME_MAX_LENGTH })
  name!: string;

  @Column({ type: 'varchar', length: PLACE_NAME_MAX_LENGTH })
  arabicName!: string;

  /** Other spellings, for "type to find" matching. */
  @Column({ type: 'jsonb' })
  names!: string[];
}
