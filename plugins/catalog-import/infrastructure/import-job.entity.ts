import { TenantEntity } from '@cod/plugin-tenancy';
import { IMPORT_MAX_URL_CHARS } from '@cod/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import {
  CONTENT_TYPE_MAX_LENGTH,
  ERROR_CODE_MAX_LENGTH,
  ETAG_MAX_LENGTH,
  JOB_WORD_MAX_LENGTH,
  MAPPING_HASH_LENGTH,
} from '../domain/constants';

/**
 * The `catalog_import_job` row (D2210): one spreadsheet import (`awaiting_upload → … → done/failed`) or one link
 * import of a store. The worker takes the scope and the confirming actor from here, never from the queue payload.
 */
@Entity('catalog_import_job')
@Index(['businessId', 'storeId', 'createdAt'])
@Index(['status', 'updatedAt'])
export class ImportJobEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  /** `spreadsheet` or `link`. */
  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH })
  kind!: string;

  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH })
  status!: string;

  /** `xlsx` or `csv`; none for a link import. */
  @Column({ type: 'varchar', length: JOB_WORD_MAX_LENGTH, nullable: true })
  format!: string | null;

  /** What the upload declared; analyze's HEAD must find exactly this (D2208). */
  @Column({ type: 'integer', nullable: true })
  declaredSize!: number | null;

  @Column({ type: 'varchar', length: CONTENT_TYPE_MAX_LENGTH, nullable: true })
  declaredContentType!: string | null;

  /** The object's ETag analyze saw; every later read sends `If-Match` with it. */
  @Column({ type: 'varchar', length: ETAG_MAX_LENGTH, nullable: true })
  etag!: string | null;

  /** The header row (0-based) and the column → field mapping of the preview. */
  @Column({ type: 'integer', nullable: true })
  headerRow!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  mapping!: unknown;

  @Column({ type: 'varchar', length: MAPPING_HASH_LENGTH, nullable: true })
  mappingHash!: string | null;

  /** Data rows read, rows applied so far, and the preview's counts per action. */
  @Column({ type: 'integer', default: 0 })
  rowCount!: number;

  @Column({ type: 'integer', default: 0 })
  progress!: number;

  @Column({ type: 'jsonb', nullable: true })
  summary!: unknown;

  /** The link of a link import, and the product it created. */
  @Column({ type: 'varchar', length: IMPORT_MAX_URL_CHARS, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'integer', nullable: true })
  productId!: number | null;

  /** The administrator who created the job, replaced by the confirming one at confirm (D2207). */
  @Column({ type: 'integer', nullable: true })
  actorAdministratorId!: number | null;

  /** A fixed code of a failed job; exception text is never stored (D2210). */
  @Column({ type: 'varchar', length: ERROR_CODE_MAX_LENGTH, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
