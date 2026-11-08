import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { NOTE_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '../domain/constants';

/**
 * The `template_note` row. Ids are `bigint` made by the application (ADR 0003) and `businessId` is a
 * NOT NULL indexed `bigint` (ADR 0002); TypeORM reads both back as decimal strings. Column types are explicit,
 * so the entity loads without decorator metadata.
 */
@Entity('template_note')
export class NoteEntity {
  @PrimaryColumn({ type: 'bigint' })
  id!: string;

  // Dated deviation 6 (P0.S2b, 2026-11-08): declared here until P1.S1's `TenantEntity` base class owns it.
  @Index()
  @Column({ type: 'bigint' })
  businessId!: string;

  @Column({ type: 'varchar', length: NOTE_TITLE_MAX_LENGTH })
  title!: string;

  @Column({ type: 'varchar', length: NOTE_BODY_MAX_LENGTH })
  body!: string;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;
}
