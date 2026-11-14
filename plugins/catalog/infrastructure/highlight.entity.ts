import { TenantEntity } from '@cod/plugin-tenancy';
import { HIGHLIGHT_TEXT_MAX } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** The `catalog_highlight` row: a selling point of one store. */
@Entity('catalog_highlight')
@Index(['businessId', 'storeId', 'createdAt', 'id'])
export class HighlightEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: HIGHLIGHT_TEXT_MAX })
  text!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;
}
