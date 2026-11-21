import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { JOB_WORD_MAX_LENGTH } from '../domain/constants';

/**
 * One previewed row of an import (D2210): what confirm does with it, its reasons (message ids only) and whether
 * it was applied. `applied` is set in the same transaction as the row's facade write, so a retried job skips it.
 */
@Entity('catalog_import_row')
@Index(['businessId', 'jobId', 'rowNumber'], { unique: true })
export class ImportRowEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  jobId!: string;

  /** The row's number in the file, as the merchant sees it (1 = the first line). */
  @Column({ type: 'integer' })
  rowNumber!: number;

  /** `create`, `update` or `error`. */
  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH })
  action!: string;

  /** The row's parsed values and the product group it belongs to. */
  @Column({ type: 'jsonb' })
  data!: unknown;

  /** Error and warning message ids. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  reasons!: unknown;

  /** The product the row updates, or the one confirm created for it. */
  @Column({ type: 'integer', nullable: true })
  productId!: number | null;

  @Column({ type: 'boolean', default: false })
  applied!: boolean;
}
