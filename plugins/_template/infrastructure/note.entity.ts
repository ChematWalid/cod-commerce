import { TenantEntity } from '@cod/plugin-tenancy';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { NOTE_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '../domain/constants';

/**
 * The `template_note` row. Ids are `bigint` made by the application (ADR 0003); `TenantEntity` adds `businessId`
 * (ADR 0002). TypeORM reads both back as decimal strings. Column types are explicit, so the entity loads without
 * decorator metadata. The composite index serves the newest-first list of one business.
 */
@Entity('template_note')
@Index(['businessId', 'createdAt', 'id'])
export class NoteEntity extends TenantEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: NOTE_TITLE_MAX_LENGTH })
  title!: string;

  @Column({ type: 'varchar', length: NOTE_BODY_MAX_LENGTH })
  body!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
