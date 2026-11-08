import { type TenantScope, toBusinessId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { createNote, type Note, toNoteId } from '../../domain/note';
import type { NoteRepositoryPort } from '../../domain/ports/note-repository.port';

const scopeA: TenantScope = { businessId: toBusinessId('101') };
const scopeB: TenantScope = { businessId: toBusinessId('202') };
const FIRST_PAGE = { take: 10, skip: 0 };

let nextId = 1_000_000_000_000_000_001n;

/** A valid note of `scope`; ids are unique across the whole run, so adapters that keep rows never collide. */
function noteOf(scope: TenantScope, title: string, minute = 0): Note {
  const id = toNoteId(String(nextId++));
  return createNote({ id, scope, title, body: `${title} body`, now: new Date(Date.UTC(2026, 10, 7, 10, minute)) });
}

/**
 * The behaviour every {@link NoteRepositoryPort} adapter must have, tenant isolation included. Each adapter's
 * test file calls it once; `makeRepo` returns an adapter over an empty store.
 */
export function describeNoteRepositoryContract(name: string, makeRepo: () => Promise<NoteRepositoryPort>): void {
  describe(`${name} (NoteRepositoryPort contract)`, () => {
    it('finds a saved note by id', async () => {
      // Arrange
      const repo = await makeRepo();
      const note = noteOf(scopeA, 'Call supplier');

      // Act
      await repo.save(scopeA, note);
      const found = await repo.findById(scopeA, note.id);

      // Assert
      expect(found).toEqual(note);
    });

    it("does not find another business's note by id", async () => {
      // Arrange
      const repo = await makeRepo();
      const noteOfA = noteOf(scopeA, 'Only for A');
      await repo.save(scopeA, noteOfA);

      // Act
      const found = await repo.findById(scopeB, noteOfA.id);

      // Assert
      expect(found).toBeUndefined();
    });

    it("lists only the scope's own notes", async () => {
      // Arrange
      const repo = await makeRepo();
      const noteOfA = noteOf(scopeA, 'Only for A');
      const noteOfB = noteOf(scopeB, 'Only for B');
      await repo.save(scopeA, noteOfA);
      await repo.save(scopeB, noteOfB);

      // Act
      const listedForB = await repo.list(scopeB, FIRST_PAGE);

      // Assert
      expect(listedForB).toEqual([noteOfB]);
    });

    it('rejects a second save of the same id, in the same or another business', async () => {
      // Arrange
      const repo = await makeRepo();
      const note = noteOf(scopeA, 'Original');
      await repo.save(scopeA, note);
      const sameId = { ...noteOf(scopeA, 'Replacement'), id: note.id };

      // Act
      const again = repo.save(scopeA, sameId);
      const fromB = repo.save(scopeB, sameId);

      // Assert
      await expect(again).rejects.toThrow();
      await expect(fromB).rejects.toThrow();
      await expect(repo.findById(scopeA, note.id)).resolves.toEqual(note);
      await expect(repo.findById(scopeB, note.id)).resolves.toBeUndefined();
    });

    it('honours take and skip, newest first', async () => {
      // Arrange
      const repo = await makeRepo();
      const [oldest, middle, newest] = [
        noteOf(scopeA, 'First', 1),
        noteOf(scopeA, 'Second', 2),
        noteOf(scopeA, 'Third', 3),
      ];
      for (const note of [middle, oldest, newest]) {
        await repo.save(scopeA, note);
      }

      // Act
      const firstTwo = await repo.list(scopeA, { take: 2, skip: 0 });
      const rest = await repo.list(scopeA, { take: 2, skip: 2 });

      // Assert
      expect(firstTwo).toEqual([newest, middle]);
      expect(rest).toEqual([oldest]);
    });
  });
}
