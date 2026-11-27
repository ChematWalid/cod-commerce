import type { WilayaCode } from '@cod/shared';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PLACE_NAME_MAX_LENGTH, WILAYA_CODE_LENGTH } from '../domain/constants';
import { GeoProvinceEntity } from './province.entity';

/**
 * The `geo_town` row: one commune, keyed by its ONS code, which stays the same when a commune moves to a new wilaya
 * (D3104). Global reference data like its wilaya (D3103). The flags are the reference availability (D3105); stores
 * narrow them through the town availability seam.
 */
@Entity('geo_town')
@Index(['provinceCode'])
export class GeoTownEntity {
  @PrimaryColumn({ type: 'integer' })
  codeOns!: number;

  @Column({ type: 'varchar', length: WILAYA_CODE_LENGTH })
  provinceCode!: WilayaCode;

  @ManyToOne(() => GeoProvinceEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'provinceCode' })
  province?: GeoProvinceEntity;

  @Column({ type: 'varchar', length: PLACE_NAME_MAX_LENGTH })
  name!: string;

  @Column({ type: 'varchar', length: PLACE_NAME_MAX_LENGTH })
  arabicName!: string;

  /** Other spellings, for "type to find" matching. */
  @Column({ type: 'jsonb' })
  names!: string[];

  @Column({ type: 'boolean' })
  isStopdesk!: boolean;

  @Column({ type: 'boolean' })
  isHomeDelivery!: boolean;
}
