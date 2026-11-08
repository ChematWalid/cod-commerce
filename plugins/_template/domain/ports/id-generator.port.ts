import type { NoteId } from '../note';

/** Hands out new note ids; ids are made by the application before insert, never by the database (ADR 0003). */
export interface IdGeneratorPort {
  next(): NoteId;
}
