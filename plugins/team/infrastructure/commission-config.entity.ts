import { TenantEntity } from '@cod/plugin-tenancy';
import {
  COMMISSION_NAME_MAX_LENGTH,
  type CommissionBasis,
  type CommissionValueKind,
  type StoreAccessKind,
} from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import {
  COMMISSION_BASIS_MAX_LENGTH,
  COMMISSION_NAME_KEY_MAX_LENGTH,
  SHORT_KIND_MAX_LENGTH,
} from '../domain/constants';

/** The `commission_config` row: one name per business, compared by its case-folded key. */
@Entity('commission_config')
@Index(['businessId', 'nameKey'], { unique: true })
export class CommissionConfigEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: COMMISSION_NAME_MAX_LENGTH })
  name!: string;

  @Column({ type: 'varchar', length: COMMISSION_NAME_KEY_MAX_LENGTH })
  nameKey!: string;

  @Column({ type: 'varchar', length: COMMISSION_BASIS_MAX_LENGTH })
  basis!: CommissionBasis;

  @Column({ type: 'varchar', length: SHORT_KIND_MAX_LENGTH })
  valueKind!: CommissionValueKind;

  @Column({ type: 'int' })
  value!: number;

  @Column({ type: 'varchar', length: SHORT_KIND_MAX_LENGTH })
  scope!: StoreAccessKind;

  @Column({ type: 'bigint', array: true })
  storeIds!: string[];

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
