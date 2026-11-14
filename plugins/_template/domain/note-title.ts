import { hasBidiControl, hasControlCharacter } from '@cod/shared';
import { NOTE_TITLE_MAX_LENGTH } from './constants';
import { InvalidNoteTitleError } from './errors';

/**
 * A note's title: trimmed, never blank, at most {@link NOTE_TITLE_MAX_LENGTH} characters, one line without control
 * characters (a NUL or an escape sequence would reach logs and the dashboard, #171) or bidi embedding, override and
 * isolate controls (they reorder the title as shown). Arabic direction marks stay.
 */
export class NoteTitle {
  private constructor(readonly value: string) {}

  /**
   * Trims `raw` and validates it.
   *
   * @throws {InvalidNoteTitleError} when the trimmed title is empty, too long or holds a control or bidi control character.
   */
  static create(raw: string): NoteTitle {
    const value = raw.trim();
    if (value === '' || value.length > NOTE_TITLE_MAX_LENGTH || hasControlCharacter(value) || hasBidiControl(value)) {
      throw new InvalidNoteTitleError();
    }
    return new NoteTitle(value);
  }

  /**
   * Rebuilds a title that was valid when it was stored. It is not re-validated: a later, stricter rule must
   * never make existing notes unreadable (a stored value is data, not caller input).
   */
  static restore(stored: string): NoteTitle {
    return new NoteTitle(stored);
  }
}
