import { type BusinessId, hasControlCharacter, type TenantScope } from '@cod/shared';
import { MAX_NOTE_ID, NOTE_BODY_MAX_LENGTH, NOTE_ID_FORMAT } from './constants';
import { InvalidNoteBodyError, InvalidNoteIdError, NoteBodyTooLongError } from './errors';
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

/** A note as it was stored: trusted values, read back from the adapter's storage. */
export interface StoredNote {
  readonly id: string;
  readonly businessId: string;
  readonly title: string;
  readonly body: string;
  readonly createdAt: Date;
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
 * @throws {InvalidNoteTitleError} for a blank or too long title, or one holding a control character, a line break or a
 *   bidi embedding, override or isolate control.
 * @throws {NoteBodyTooLongError} for a body over {@link NOTE_BODY_MAX_LENGTH} characters.
 * @throws {InvalidNoteBodyError} for a body holding a control character other than a tab or a line break.
 */
export function createNote(input: NewNoteInput): Note {
  const title = NoteTitle.create(input.title);
  if (input.body.length > NOTE_BODY_MAX_LENGTH) {
    throw new NoteBodyTooLongError();
  }
  if (hasControlCharacter(input.body, { allowLineBreaks: true })) {
    throw new InvalidNoteBodyError();
  }
  return { id: input.id, businessId: input.scope.businessId, title, body: input.body, createdAt: input.now };
}

/**
 * Rebuilds a stored note without re-validating it: only {@link createNote} validates, and only new input.
 * A row that breaks a rule added later stays readable instead of failing every read as a client error.
 */
export function restoreNote(stored: StoredNote): Note {
  return {
    id: stored.id as NoteId,
    businessId: stored.businessId as BusinessId,
    title: NoteTitle.restore(stored.title),
    body: stored.body,
    createdAt: stored.createdAt,
  };
}
