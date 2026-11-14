import { DomainError } from '@cod/shared';
import { NOTE_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from './constants';

/**
 * A note title that is blank or longer than {@link NOTE_TITLE_MAX_LENGTH} once trimmed, or holds a control
 * character or line break.
 */
export class InvalidNoteTitleError extends DomainError {
  readonly code = 'TEMPLATE_NOTE_INVALID_TITLE';

  constructor() {
    super(
      `A note title needs 1 to ${String(NOTE_TITLE_MAX_LENGTH)} characters, on one line, without control characters`,
    );
  }
}

/** A note body holding a control character other than a tab or a line break. */
export class InvalidNoteBodyError extends DomainError {
  readonly code = 'TEMPLATE_NOTE_INVALID_BODY';

  constructor() {
    super('A note body may not hold control characters other than tabs and line breaks');
  }
}

/** A note body longer than {@link NOTE_BODY_MAX_LENGTH}. */
export class NoteBodyTooLongError extends DomainError {
  readonly code = 'TEMPLATE_NOTE_BODY_TOO_LONG';

  constructor() {
    super(`A note body has at most ${String(NOTE_BODY_MAX_LENGTH)} characters`);
  }
}

/** A value that is not a note id (see `NOTE_ID_FORMAT`). The message does not repeat the value. */
export class InvalidNoteIdError extends DomainError {
  readonly code = 'TEMPLATE_NOTE_INVALID_ID';

  constructor() {
    super('A note id is a positive 63-bit integer in decimal');
  }
}
