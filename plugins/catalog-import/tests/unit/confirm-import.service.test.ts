import { describe, expect, it } from 'vitest';
import { ConfirmImportService } from '../../application/confirm-import.service';
import { ConfirmNeedsEditError, JobNotFoundError, JobStateError } from '../../domain/errors';
import { importSourceKey } from '../../domain/object-keys';
import { FakeImportWorld, plannedRow, previewedJob } from '../fakes/fake-import';
import { OTHER_SCOPE, SCOPE } from '../support/scope';

const OWNER = { administratorId: 9, canEdit: true };
const CREATE_ONLY = { administratorId: 12, canEdit: false };

/** A world holding one previewed job of `SCOPE` whose file is unchanged since its preview. */
function worldWith(rows = [plannedRow()]): { world: FakeImportWorld; id: string } {
  const world = new FakeImportWorld();
  const job = previewedJob();
  world.jobs.set(job.id, job);
  world.rows.set(job.id, rows);
  world.heads.set(importSourceKey(SCOPE, job.id), { size: 120, etag: '"etag-1"', contentType: 'text/csv' });
  return { world, id: job.id };
}

const serviceOf = (world: FakeImportWorld): ConfirmImportService =>
  new ConfirmImportService({
    jobs: world.jobStore,
    rows: world.rowStore,
    storage: world.storage,
    formats: world.formats,
    queue: world.queue,
  });

describe('ConfirmImportService (D2207, D2210, Review Focus 4)', () => {
  it('a create-only actor cannot confirm stored update rows', async () => {
    // Arrange
    const { world, id } = worldWith([plannedRow(), plannedRow({ rowNumber: 3, action: 'update', productId: '7' })]);

    // Act
    const confirming = serviceOf(world).confirm(world.ctx, SCOPE, CREATE_ONLY, id);

    // Assert
    await expect(confirming).rejects.toBeInstanceOf(ConfirmNeedsEditError);
    expect(world.jobs.get(id)?.status).toBe('previewed');
    expect(world.enqueued).toEqual([]);
  });

  it('a create-only actor confirms a preview of creates only', async () => {
    // Arrange
    const { world, id } = worldWith();

    // Act
    const view = await serviceOf(world).confirm(world.ctx, SCOPE, CREATE_ONLY, id);

    // Assert
    expect(view).toMatchObject({ importId: id, status: 'confirming' });
    expect(world.enqueued).toEqual([{ table: 'import', id, ...SCOPE }]);
  });

  it('the confirming actor id is stored on the job', async () => {
    // Arrange: the owner (5) previewed; another administrator (9) confirms
    const { world, id } = worldWith();

    // Act
    await serviceOf(world).confirm(world.ctx, SCOPE, OWNER, id);

    // Assert
    expect(world.jobs.get(id)).toMatchObject({ status: 'confirming', actorAdministratorId: OWNER.administratorId });
  });

  it('a second confirm answers job-state and enqueues nothing more', async () => {
    // Arrange
    const { world, id } = worldWith();
    const service = serviceOf(world);
    await service.confirm(world.ctx, SCOPE, OWNER, id);

    // Act and Assert
    await expect(service.confirm(world.ctx, SCOPE, OWNER, id)).rejects.toBeInstanceOf(JobStateError);
    expect(world.enqueued).toHaveLength(1);
  });

  it('a file re-put after the preview (ETag changed) is refused', async () => {
    // Arrange
    const { world, id } = worldWith();
    world.heads.set(importSourceKey(SCOPE, id), { size: 120, etag: '"etag-2"', contentType: 'text/csv' });

    // Act and Assert
    await expect(serviceOf(world).confirm(world.ctx, SCOPE, OWNER, id)).rejects.toBeInstanceOf(JobStateError);
    expect(world.jobs.get(id)?.status).toBe('previewed');
  });

  it('a job of no job of the store, or a malformed id, is not found', async () => {
    // Arrange
    const { world } = worldWith();
    const service = serviceOf(world);

    // Act and Assert
    await expect(service.confirm(world.ctx, OTHER_SCOPE, OWNER, '900000000000999')).rejects.toBeInstanceOf(
      JobNotFoundError,
    );
    await expect(service.confirm(world.ctx, SCOPE, OWNER, '../x')).rejects.toBeInstanceOf(JobNotFoundError);
  });
});
