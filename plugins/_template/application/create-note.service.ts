import type { TenantScope } from '@cod/shared';
import { createNote, type Note } from '../domain/note';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { NoteRepositoryPort } from '../domain/ports/note-repository.port';

/** A request to create a note. It names no business: the business is the caller's scope. */
export interface CreateNoteCommand {
  readonly title: string;
  readonly body: string;
}

/** Creates a note for the caller's business. */
export class CreateNoteService {
  constructor(
    private readonly notes: NoteRepositoryPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: () => Date,
  ) {}

  /**
   * Validates and stores a new note under `scope`; nothing is stored when the note is invalid.
   *
   * @throws {InvalidNoteTitleError} for a blank or too long title, or one holding a control or bidi control character.
   * @throws {NoteBodyTooLongError} for a body over the maximum length.
   * @throws {InvalidNoteBodyError} for a body holding a control character other than a tab or a line break.
   */
  async execute(scope: TenantScope, command: CreateNoteCommand): Promise<Note> {
    const note = createNote({
      id: this.ids.next(),
      scope,
      title: command.title,
      body: command.body,
      now: this.clock(),
    });
    await this.notes.save(scope, note);
    return note;
  }
}
