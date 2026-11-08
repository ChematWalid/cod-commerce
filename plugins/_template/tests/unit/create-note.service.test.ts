import { type TenantScope, toBusinessId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { CreateNoteService } from '../../application/create-note.service';
import { InvalidNoteTitleError } from '../../domain/errors';
import { InMemoryNoteRepository } from '../fakes/in-memory-note.repository';
import { SequentialIdGenerator } from '../fakes/sequential-id.generator';

const NOW = new Date('2026-11-07T10:00:00Z');
const FIRST_ID = '1000000000000000001';
const caller: TenantScope = { businessId: toBusinessId('11') };

function arrange(): { notes: InMemoryNoteRepository; service: CreateNoteService } {
  const notes = new InMemoryNoteRepository();
  const service = new CreateNoteService(notes, new SequentialIdGenerator(FIRST_ID), () => NOW);
  return { notes, service };
}

describe('CreateNoteService', () => {
  it("stores the note under the caller's business", async () => {
    // Arrange
    const { notes, service } = arrange();

    // Act
    const created = await service.execute(caller, { title: 'Call supplier', body: 'About the late order' });

    // Assert
    expect(created).toMatchObject({ id: FIRST_ID, businessId: '11', body: 'About the late order', createdAt: NOW });
    expect(created.title.value).toBe('Call supplier');
    await expect(notes.findById(caller, created.id)).resolves.toEqual(created);
  });

  it('does not store an invalid note', async () => {
    // Arrange
    const { notes, service } = arrange();

    // Act
    const outcome = service.execute(caller, { title: '   ', body: '' });

    // Assert
    await expect(outcome).rejects.toBeInstanceOf(InvalidNoteTitleError);
    await expect(notes.list(caller, { take: 10, skip: 0 })).resolves.toEqual([]);
  });
});
