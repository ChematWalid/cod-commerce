import type { TenantScope } from '@cod/shared';
import type { Note, NoteId } from '../domain/note';
import type { NotePage, NoteRepositoryPort } from '../domain/ports/note-repository.port';

/** Reads the notes of the caller's business. */
export class GetNotesService {
  constructor(private readonly notes: NoteRepositoryPort) {}

  /** The note `id` of the business of `scope`, or `undefined` when it has none with that id. */
  byId(scope: TenantScope, id: NoteId): Promise<Note | undefined> {
    return this.notes.findById(scope, id);
  }

  /** One page of the business's notes, newest first. */
  list(scope: TenantScope, page: NotePage): Promise<readonly Note[]> {
    return this.notes.list(scope, page);
  }
}
