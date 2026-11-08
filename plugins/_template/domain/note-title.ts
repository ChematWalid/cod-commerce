import { NOTE_TITLE_MAX_LENGTH } from './constants';
import { InvalidNoteTitleError } from './errors';

/** A note's title: trimmed, never blank, at most {@link NOTE_TITLE_MAX_LENGTH} characters. */
export class NoteTitle {
  private constructor(readonly value: string) {}

  /**
   * Trims `raw` and validates it.
   *
   * @throws {InvalidNoteTitleError} when the trimmed title is empty or too long.
   */
  static create(raw: string): NoteTitle {
    const value = raw.trim();
    if (value === '' || value.length > NOTE_TITLE_MAX_LENGTH) {
      throw new InvalidNoteTitleError();
    }
    return new NoteTitle(value);
  }
}
