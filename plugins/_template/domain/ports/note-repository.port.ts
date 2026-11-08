import type { TenantScope } from '@cod/shared';
import type { Note, NoteId } from '../note';

/** One page of a list: at most `take` notes, after skipping `skip`. */
export interface NotePage {
  readonly take: number;
  readonly skip: number;
}

/**
 * Where notes are kept. Every method is scoped: an adapter reads and writes only the notes of
 * `scope.businessId`, so a note of another business is never found, listed or overwritten.
 */
export interface NoteRepositoryPort {
  /**
   * Stores a new note under `scope.businessId` (the scope wins over `note.businessId`).
   * Rejects when a note with the same id exists, in any business: a save never overwrites.
   */
  save(scope: TenantScope, note: Note): Promise<void>;

  /** The note `id` of the scope's business, or `undefined` when it has none: another business's note is never found. */
  findById(scope: TenantScope, id: NoteId): Promise<Note | undefined>;

  /** At most `page.take` notes of the scope's business after skipping `page.skip`, newest first, then by id descending. */
  list(scope: TenantScope, page: NotePage): Promise<readonly Note[]>;
}
