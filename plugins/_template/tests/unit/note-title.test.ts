import { type TenantScope, toBusinessId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { NOTE_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '../../domain/constants';
import { InvalidNoteBodyError, InvalidNoteTitleError, NoteBodyTooLongError } from '../../domain/errors';
import { createNote, restoreNote, toNoteId } from '../../domain/note';
import { NoteTitle } from '../../domain/note-title';

const scope: TenantScope = { businessId: toBusinessId('7') };
const NOW = new Date('2026-11-07T10:00:00Z');

describe('NoteTitle', () => {
  it('trims the surrounding whitespace', () => {
    // Act
    const title = NoteTitle.create('  Call supplier  ');

    // Assert
    expect(title.value).toBe('Call supplier');
  });

  it('rejects a blank title', () => {
    // Act
    const create = (): NoteTitle => NoteTitle.create('   ');

    // Assert
    expect(create).toThrow(InvalidNoteTitleError);
  });

  it('accepts the maximum length and rejects one character more', () => {
    // Arrange
    const longest = 'a'.repeat(NOTE_TITLE_MAX_LENGTH);

    // Act
    const accepted = NoteTitle.create(longest);
    const tooLong = (): NoteTitle => NoteTitle.create(`${longest}a`);

    // Assert
    expect(NOTE_TITLE_MAX_LENGTH).toBe(120);
    expect(accepted.value).toHaveLength(120);
    expect(tooLong).toThrow(InvalidNoteTitleError);
  });

  it('refuses a NUL character in a title', () => {
    // Act
    const create = (): NoteTitle => NoteTitle.create('a\u0000b');

    // Assert
    expect(create).toThrow(InvalidNoteTitleError);
  });

  it('refuses a line break in a title', () => {
    // Act
    const create = (): NoteTitle => NoteTitle.create('first\nsecond');

    // Assert
    expect(create).toThrow(InvalidNoteTitleError);
  });

  it('refuses a bidi override in a title', () => {
    // Act
    const create = (): NoteTitle => NoteTitle.create('Invoice\u202Efdp.exe');

    // Assert
    expect(create).toThrow(InvalidNoteTitleError);
  });

  it('keeps an Arabic title with its direction marks', () => {
    // Act
    const title = NoteTitle.create('\u200Fاتصل بالمورد');

    // Assert
    expect(title.value).toBe('\u200Fاتصل بالمورد');
  });
});

describe('restoreNote', () => {
  it("restores a stored title longer than today's limit without re-validating it", () => {
    // Arrange
    const storedTitle = 't'.repeat(NOTE_TITLE_MAX_LENGTH + 1);

    // Act
    const note = restoreNote({ id: '42', businessId: '7', title: storedTitle, body: '', createdAt: NOW });

    // Assert
    expect(note.title.value).toBe(storedTitle);
    expect(note).toMatchObject({ id: '42', businessId: '7', createdAt: NOW });
  });
});

describe('createNote', () => {
  it('rejects a body longer than the maximum', () => {
    // Arrange
    const body = 'b'.repeat(NOTE_BODY_MAX_LENGTH + 1);

    // Act
    const create = (): unknown => createNote({ id: toNoteId('1'), scope, title: 'Call supplier', body, now: NOW });

    // Assert
    expect(body).toHaveLength(2001);
    expect(create).toThrow(NoteBodyTooLongError);
  });

  it('refuses a control character in a body', () => {
    // Act
    const create = (): unknown =>
      createNote({ id: toNoteId('1'), scope, title: 'Call supplier', body: 'a\u0007b', now: NOW });

    // Assert
    expect(create).toThrow(InvalidNoteBodyError);
  });

  it('accepts tabs and line breaks in a body', () => {
    // Act
    const note = createNote({ id: toNoteId('1'), scope, title: 'Call supplier', body: 'one\n\ttwo\r\n', now: NOW });

    // Assert
    expect(note.body).toBe('one\n\ttwo\r\n');
  });

  it("builds a note under the scope's business", () => {
    // Act
    const note = createNote({ id: toNoteId('1'), scope, title: ' Call supplier ', body: 'Tomorrow', now: NOW });

    // Assert
    expect(note).toEqual({
      id: '1',
      businessId: '7',
      title: NoteTitle.create('Call supplier'),
      body: 'Tomorrow',
      createdAt: NOW,
    });
  });
});
