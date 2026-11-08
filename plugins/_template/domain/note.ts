import type { BusinessId, TenantScope } from '@cod/shared';
import { MAX_NOTE_ID, NOTE_BODY_MAX_LENGTH, NOTE_ID_FORMAT } from './constants';
import { InvalidNoteIdError, NoteBodyTooLongError } from './errors';
import { NoteTitle } from './note-title';

/** A note id, as a decimal string (ADR 0003: ids are strings outside the database). */
export type NoteId = string & { readonly __brand: 'NoteId' };

/** A short note one business keeps; it never leaves that business. */
export interface Note {
  readonly id: NoteId;
  readonly businessId: BusinessId;
  readonly title: NoteTitle;
  readonly body: string;
  readonly createdAt: Date;
}

/** What {@link createNote} needs: the raw title and body come from the caller, the rest from the use case. */
export interface NewNoteInput {
  readonly id: NoteId;
  readonly scope: TenantScope;
  readonly title: string;
  readonly body: string;
  readonly now: Date;
}

/**
 * Validates and brands a note id.
 *
 * @throws {InvalidNoteIdError} unless `value` is a decimal integer from 1 to {@link MAX_NOTE_ID}.
 */
export function toNoteId(value: string): NoteId {
  if (!NOTE_ID_FORMAT.test(value) || BigInt(value) > MAX_NOTE_ID) {
    throw new InvalidNoteIdError();
  }
  return value as NoteId;
}

/**
 * Builds a valid note owned by the business of `scope`.
 *
 * @throws {InvalidNoteTitleError} for a blank or too long title.
 * @throws {NoteBodyTooLongError} for a body over {@link NOTE_BODY_MAX_LENGTH} characters.
 */
export function createNote(input: NewNoteInput): Note {
  const title = NoteTitle.create(input.title);
  if (input.body.length > NOTE_BODY_MAX_LENGTH) {
    throw new NoteBodyTooLongError();
  }
  return { id: input.id, businessId: input.scope.businessId, title, body: input.body, createdAt: input.now };
}
