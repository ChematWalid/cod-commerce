import { TenantEntity } from '@cod/plugin-tenancy';
import type { ExportJobStatus } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { ERROR_CODE_MAX_LENGTH, JOB_WORD_MAX_LENGTH } from '../domain/constants';

/** The `catalog_export_job` row (D2211): one export of a store's products, `queued → running → done/failed`. */
@Entity('catalog_export_job')
@Index(['businessId', 'storeId', 'createdAt'])
@Index(['status', 'updatedAt'])
export class ExportJobEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH })
  status!: ExportJobStatus;

  /** `xlsx` or `csv`. */
  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH })
  format!: string;

  /** `selected` (ids) or `filtered` (the list's query). */
  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH })
  scope!: string;

  /** The selected ids or the list query, and the columns asked for. */
  @Column({ type: 'jsonb', nullable: true })
  query!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  fields!: unknown;

  @Column({ type: 'integer', default: 0 })
  rowCount!: number;

  @Column({ type: 'integer', default: 0 })
  progress!: number;

  /** Pack products left out (D2220). */
  @Column({ type: 'integer', default: 0 })
  skippedPacks!: number;

  @Column({ type: 'integer', nullable: true })
  actorAdministratorId!: number | null;

  @Column({ type: 'varchar', length: ERROR_CODE_MAX_LENGTH, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
