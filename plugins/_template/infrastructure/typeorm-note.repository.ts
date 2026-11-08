import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { type Note, type NoteId, restoreNote } from '../domain/note';
import type { NotePage, NoteRepositoryPort } from '../domain/ports/note-repository.port';
import { NoteEntity } from './note.entity';

function toRow(note: Note): Pick<NoteEntity, 'id' | 'title' | 'body' | 'createdAt'> {
  return { id: note.id, title: note.title.value, body: note.body, createdAt: note.createdAt };
}

/**
 * The Postgres adapter of {@link NoteRepositoryPort}, on `TenantRepository` (ADR 0002): every call is confined to the
 * scope's business and joins the request's transaction when the scope carries one.
 */
@Injectable()
export class TypeOrmNoteRepository implements NoteRepositoryPort {
  private readonly notes: TenantRepository<NoteEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.notes = repositories.for(NoteEntity);
  }

  /** Inserts the note under the scope's business; rejects (unique violation) when the id exists. */
  async save(scope: TenantScope, note: Note): Promise<void> {
    await this.notes.insert(scope, toRow(note));
  }

  /** The note `id` of the scope's business, or `undefined` (also when another business owns it). */
  async findById(scope: TenantScope, id: NoteId): Promise<Note | undefined> {
    const row = await this.notes.findOne(scope, { id });
    return row === null ? undefined : restoreNote(row);
  }

  /** One page of the scope's business's notes, newest first, then by id descending. */
  async list(scope: TenantScope, page: NotePage): Promise<readonly Note[]> {
    const rows = await this.notes.find(scope, {
      order: { createdAt: 'DESC', id: 'DESC' },
      take: page.take,
      skip: page.skip,
    });
    return rows.map(restoreNote);
  }
}
