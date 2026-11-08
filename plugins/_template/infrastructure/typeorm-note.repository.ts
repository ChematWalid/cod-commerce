import { type TenantScope, toBusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { Repository } from 'typeorm';
import { createNote, type Note, type NoteId, toNoteId } from '../domain/note';
import type { NotePage, NoteRepositoryPort } from '../domain/ports/note-repository.port';
import { NoteEntity } from './note.entity';
import { requestContextOf } from './request-tenant-scope';

function toRow(scope: TenantScope, note: Note): NoteEntity {
  return Object.assign(new NoteEntity(), {
    id: note.id,
    // The scope is authoritative: a row is always written under the caller's business.
    businessId: scope.businessId,
    title: note.title.value,
    body: note.body,
    createdAt: note.createdAt,
  });
}

function toNote(row: NoteEntity): Note {
  const scope = { businessId: toBusinessId(row.businessId) };
  return createNote({ id: toNoteId(row.id), scope, title: row.title, body: row.body, now: row.createdAt });
}

/**
 * The Postgres adapter of {@link NoteRepositoryPort}. Every query filters by the scope's `businessId`
 * (ADR 0002) and runs in the request's transaction when the scope carries one.
 */
@Injectable()
export class TypeOrmNoteRepository implements NoteRepositoryPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async save(scope: TenantScope, note: Note): Promise<void> {
    await this.repository(scope).insert(toRow(scope, note));
  }

  async findById(scope: TenantScope, id: NoteId): Promise<Note | undefined> {
    const row = await this.repository(scope).findOne({ where: { businessId: scope.businessId, id } });
    return row === null ? undefined : toNote(row);
  }

  async list(scope: TenantScope, page: NotePage): Promise<readonly Note[]> {
    const rows = await this.repository(scope).find({
      where: { businessId: scope.businessId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: page.take,
      skip: page.skip,
    });
    return rows.map(toNote);
  }

  private repository(scope: TenantScope): Repository<NoteEntity> {
    return this.connection.getRepository(requestContextOf(scope), NoteEntity);
  }
}
