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
  save(scope: TenantScope, note: Note): Promise<void>;
  findById(scope: TenantScope, id: NoteId): Promise<Note | undefined>;
  /** Newest first. */
  list(scope: TenantScope, page: NotePage): Promise<readonly Note[]>;
}
