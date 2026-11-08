import type { TenantScope } from '@cod/shared';
import type { Note, NoteId } from '../../domain/note';
import type { NotePage, NoteRepositoryPort } from '../../domain/ports/note-repository.port';

/** Newest first, then the larger id first: the order the TypeORM adapter lists in. */
function newestFirst(left: Note, right: Note): number {
  const byTime = right.createdAt.getTime() - left.createdAt.getTime();
  if (byTime !== 0) {
    return byTime;
  }
  return BigInt(right.id) > BigInt(left.id) ? 1 : -1;
}

/** A {@link NoteRepositoryPort} over an array, for use-case tests; it passes the same contract as the real adapter. */
export class InMemoryNoteRepository implements NoteRepositoryPort {
  private notes: readonly Note[] = [];

  /** Rejects a duplicate id in any business, like the primary key of the TypeORM adapter's insert. */
  save(scope: TenantScope, note: Note): Promise<void> {
    if (this.notes.some((existing) => existing.id === note.id)) {
      return Promise.reject(new Error(`Duplicate note id ${note.id}`));
    }
    this.notes = [...this.notes, { ...note, businessId: scope.businessId }];
    return Promise.resolve();
  }

  findById(scope: TenantScope, id: NoteId): Promise<Note | undefined> {
    return Promise.resolve(this.ownedBy(scope).find((note) => note.id === id));
  }

  list(scope: TenantScope, page: NotePage): Promise<readonly Note[]> {
    const sorted = [...this.ownedBy(scope)].sort(newestFirst);
    return Promise.resolve(sorted.slice(page.skip, page.skip + page.take));
  }

  private ownedBy(scope: TenantScope): readonly Note[] {
    return this.notes.filter((note) => note.businessId === scope.businessId);
  }
}
