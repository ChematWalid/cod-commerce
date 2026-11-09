import type { SnowflakeIdGeneratorPort } from '@cod/plugin-tenancy';
import { type NoteId, toNoteId } from '../domain/note';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';

/** Note ids from the platform's ADR 0003 snowflake generator. */
export class SnowflakeNoteIdGenerator implements IdGeneratorPort {
  constructor(private readonly ids: SnowflakeIdGeneratorPort) {}

  /** A new time-ordered note id. */
  next(): NoteId {
    return toNoteId(this.ids.next());
  }
}
