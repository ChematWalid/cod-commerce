import { describe, expect, it } from 'vitest';
import { PreviewImportService } from '../../application/preview-import.service';
import { JobStateError } from '../../domain/errors';
import { importSourceKey } from '../../domain/object-keys';
import { FakeImportWorld, plannedRow, previewedJob } from '../fakes/fake-import';
import { bytesOf, SCOPE } from '../support/scope';

const CONFIRMED_ROWS = [plannedRow({ rowNumber: 2 }), plannedRow({ rowNumber: 3 })];

/** A world holding one previewed csv import of `SCOPE`, its file two products long. */
function worldWith(): { world: FakeImportWorld; id: string } {
  const world = new FakeImportWorld();
  const job = previewedJob({ mapping: null, rowCount: 2 });
  world.jobs.set(job.id, job);
  world.rows.set(job.id, CONFIRMED_ROWS);
  world.files.set(importSourceKey(SCOPE, job.id), bytesOf('name,price\r\nShirt,1500\r\nCap,900\r\n'));
  return { world, id: job.id };
}

/** The preview use case over `world`; `whileReading` runs as the file is read (a concurrent, committed change). */
const serviceOf = (world: FakeImportWorld, whileReading: () => void = () => undefined): PreviewImportService =>
  new PreviewImportService({
    jobs: world.jobStore,
    rows: world.rowStore,
    catalog: world.catalog,
    storage: {
      read: (key) => {
        whileReading();
        return world.storage.read(key);
      },
    },
    formats: world.formats,
    units: world.units,
  });

describe('PreviewImportService (D2209, D2210, D2265)', () => {
  it('stores the planned rows of the file and answers its first page', async () => {
    // Arrange
    const { world, id } = worldWith();

    // Act
    const view = await serviceOf(world).preview(world.ctx, SCOPE, { importId: id, canEdit: true });

    // Assert
    expect(view.summary).toEqual({ creates: 2, updates: 0, errors: 0, warnings: 0 });
    expect(world.rows.get(id)?.map((row) => row.values.name)).toEqual(['Shirt', 'Cap']);
    expect(world.jobs.get(id)?.status).toBe('previewed');
  });

  it('a preview whose job was confirmed meanwhile answers job-state and leaves the confirmed rows', async () => {
    // Arrange: a confirm commits its move after the preview read the job, while it reads the file
    const { world, id } = worldWith();
    const confirm = (): void => {
      const job = world.jobs.get(id);
      if (job?.status === 'previewed') world.jobs.set(id, { ...job, status: 'confirming' });
    };

    // Act
    const previewing = serviceOf(world, confirm).preview(world.ctx, SCOPE, { importId: id, canEdit: true });

    // Assert
    await expect(previewing).rejects.toBeInstanceOf(JobStateError);
    expect(world.rows.get(id)).toEqual(CONFIRMED_ROWS);
    expect(world.jobs.get(id)?.status).toBe('confirming');
  });
});
