import {
  CATALOG_IMPORT_ERROR_CODES,
  EXPORT_HEADER,
  EXPORT_MAX_ROWS,
  EXPORT_SYNC_MAX_ROWS,
  exportInputSchema,
} from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ExportProductsService } from '../../application/export-products.service';
import { ExportStatusService } from '../../application/export-status.service';
import { RunExportJobService } from '../../application/run-export-job.service';
import { TooManyRowsError } from '../../domain/errors';
import { FakeExportWorld } from '../fakes/fake-export';
import { SCOPE } from '../support/scope';

const ACTOR = { administratorId: 7, ip: '192.0.2.1', userAgent: 'test-agent' };
const filtered = (format: 'csv' | 'xlsx' = 'csv') =>
  exportInputSchema.parse({ scope: 'filtered', format, query: { tab: 'all' } });

function serviceOf(world: FakeExportWorld): ExportProductsService {
  return new ExportProductsService(world);
}

describe('ExportProductsService (D2211)', () => {
  it('writes selected products now, under exports/ of the store, with an attachment link and one activity row', async () => {
    // Arrange
    const world = new FakeExportWorld(3);
    const command = exportInputSchema.parse({ scope: 'selected', format: 'csv', productIds: ['2', '1'] });

    // Act
    const view = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, command);

    // Assert
    expect(view).toMatchObject({ status: 'done', rowCount: 2, progress: 100, errorCode: null });
    expect(view.downloadUrl).toBe(
      `fake://exports/b/${SCOPE.businessId}/s/${SCOPE.storeId}/exports/${view.exportId}/file?name=products-${view.exportId}.csv`,
    );
    expect(world.builds[0]).toMatchObject({ productIds: ['2', '1'], fields: EXPORT_HEADER, format: 'csv' });
    expect([...world.objects.keys()]).toEqual([
      `exports/b/${SCOPE.businessId}/s/${SCOPE.storeId}/exports/${view.exportId}/file`,
    ]);
    expect(world.activities).toEqual([
      expect.objectContaining({ exportId: view.exportId, exportScope: 'selected', rowCount: 2, actor: ACTOR }),
    ]);
    expect(world.enqueued).toEqual([]);
  });

  it('writes a filtered scope of at most 500 products now, paging the ids ascending', async () => {
    // Arrange
    const world = new FakeExportWorld(500);

    // Act
    const view = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());

    // Assert
    expect(view.status).toBe('done');
    expect(world.builds[0]?.productIds).toHaveLength(500);
    expect(world.pageReads.map((page) => page.skip)).toEqual([0, 100, 200, 300, 400]);
  });

  it('hands 501 filtered products to the worker as a queued row, with no file and no activity yet', async () => {
    // Arrange
    const world = new FakeExportWorld(501);

    // Act
    const view = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());

    // Assert
    expect(view).toMatchObject({ status: 'queued', progress: 0, downloadUrl: null });
    expect(world.enqueued).toEqual([{ table: 'export', id: view.exportId, ...SCOPE }]);
    expect(world.builds).toEqual([]);
    expect(world.activities).toEqual([]);
    expect(world.rows.get(view.exportId)?.target).toEqual({ kind: 'filtered', filter: { tab: 'all' } });
  });

  it('filtered scope above EXPORT_MAX_ROWS → too-many-rows, nothing written', async () => {
    // Arrange
    const world = new FakeExportWorld(20_001);

    // Act
    const call = serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());

    // Assert
    await expect(call).rejects.toBeInstanceOf(TooManyRowsError);
    expect(world.rows.size).toBe(0);
    expect(world.objects.size).toBe(0);
    expect(world.enqueued).toEqual([]);
  });

  it('hands selected products writing more than EXPORT_SYNC_MAX_ROWS variant rows to the worker (D2259)', async () => {
    // Arrange
    const world = new FakeExportWorld(2);
    world.variantsPerProduct = 300;
    const command = exportInputSchema.parse({ scope: 'selected', format: 'csv', productIds: ['1', '2'] });

    // Act
    const view = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, command);

    // Assert
    expect(world.builds[0]?.maxRows).toBe(EXPORT_SYNC_MAX_ROWS);
    expect(view).toMatchObject({ status: 'queued', downloadUrl: null });
    expect(world.rows.get(view.exportId)?.target).toEqual({ kind: 'selected', productIds: ['1', '2'] });
    expect(world.enqueued).toEqual([{ table: 'export', id: view.exportId, ...SCOPE }]);
    expect(world.objects.size).toBe(0);
    expect(world.activities).toEqual([]);
  });

  it('keeps product_key, name and price in a partial export, in header order', async () => {
    // Arrange
    const world = new FakeExportWorld(1);
    const command = exportInputSchema.parse({
      scope: 'selected',
      format: 'xlsx',
      productIds: ['1'],
      fields: ['brand'],
    });

    // Act
    await serviceOf(world).export(world.ctx, SCOPE, ACTOR, command);

    // Assert
    expect(world.builds[0]?.fields).toEqual(['product_key', 'name', 'price', 'brand']);
  });
});

describe('RunExportJobService (D2211, D2212)', () => {
  it('runs a queued export: progress, file, done and an activity row for the stored actor', async () => {
    // Arrange
    const world = new FakeExportWorld(601);
    const queued = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());
    const runner = new RunExportJobService(world);

    // Act
    await runner.run(world.ctx, SCOPE, queued.exportId);

    // Assert
    expect(world.rows.get(queued.exportId)).toMatchObject({ status: 'done', rowCount: 601, progress: 100 });
    expect(world.objects.has(`exports/b/${SCOPE.businessId}/s/${SCOPE.storeId}/exports/${queued.exportId}/file`)).toBe(
      true,
    );
    expect(world.progress).toContain(100);
    expect(world.activities).toEqual([
      expect.objectContaining({
        exportId: queued.exportId,
        exportScope: 'filtered',
        rowCount: 601,
        actor: { administratorId: ACTOR.administratorId, ip: null, userAgent: null },
      }),
    ]);
  });

  it('fails the row with too-many-rows when the filter grew past the cap, writing nothing', async () => {
    // Arrange
    const world = new FakeExportWorld(600);
    const queued = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());
    world.productCount = 20_001;

    // Act
    await new RunExportJobService(world).run(world.ctx, SCOPE, queued.exportId);

    // Assert
    expect(world.rows.get(queued.exportId)).toMatchObject({
      status: 'failed',
      errorCode: CATALOG_IMPORT_ERROR_CODES.TOO_MANY_ROWS,
    });
    expect(world.objects.size).toBe(0);
    expect(world.activities).toEqual([]);
  });

  it('fails the row with too-many-rows when its products write more than EXPORT_MAX_ROWS rows (D2259)', async () => {
    // Arrange
    const world = new FakeExportWorld(600);
    const queued = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());
    world.variantsPerProduct = 100;

    // Act
    await new RunExportJobService(world).run(world.ctx, SCOPE, queued.exportId);

    // Assert
    expect(world.builds.at(-1)?.maxRows).toBe(EXPORT_MAX_ROWS);
    expect(world.rows.get(queued.exportId)).toMatchObject({
      status: 'failed',
      errorCode: CATALOG_IMPORT_ERROR_CODES.TOO_MANY_ROWS,
    });
    expect(world.objects.size).toBe(0);
    expect(world.activities).toEqual([]);
  });

  it('records the activity of a job whose administrator is gone with no actor', async () => {
    // Arrange
    const world = new FakeExportWorld(501);
    const queued = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());
    const row = world.rows.get(queued.exportId);
    if (row === undefined) throw new Error('no queued row');
    world.rows.set(queued.exportId, { ...row, actorAdministratorId: null });

    // Act
    await new RunExportJobService(world).run(world.ctx, SCOPE, queued.exportId);

    // Assert
    expect(world.rows.get(queued.exportId)?.status).toBe('done');
    expect(world.activities).toEqual([
      expect.objectContaining({
        exportId: queued.exportId,
        actor: { administratorId: null, ip: null, userAgent: null },
      }),
    ]);
  });

  it('leaves a done row alone and a missing row unread', async () => {
    // Arrange
    const world = new FakeExportWorld(1);
    const done = await serviceOf(world).export(
      world.ctx,
      SCOPE,
      ACTOR,
      exportInputSchema.parse({ scope: 'selected', format: 'csv', productIds: ['1'] }),
    );
    const builds = world.builds.length;

    // Act
    await new RunExportJobService(world).run(world.ctx, SCOPE, done.exportId);
    await new RunExportJobService(world).run(world.ctx, SCOPE, '900000000999');

    // Assert
    expect(world.builds).toHaveLength(builds);
  });
});

describe('ExportStatusService', () => {
  it.each(['not-a-snowflake', '900000000999'])('answers job-not-found for %s', async (id) => {
    // Arrange
    const world = new FakeExportWorld(0);

    // Act
    const call = new ExportStatusService(world).status(world.ctx, SCOPE, id);

    // Assert
    await expect(call).rejects.toMatchObject({ code: CATALOG_IMPORT_ERROR_CODES.JOB_NOT_FOUND });
  });

  it('signs a download only once the export is done', async () => {
    // Arrange
    const world = new FakeExportWorld(501);
    const queued = await serviceOf(world).export(world.ctx, SCOPE, ACTOR, filtered());
    const status = new ExportStatusService(world);

    // Act
    const before = await status.status(world.ctx, SCOPE, queued.exportId);
    await new RunExportJobService(world).run(world.ctx, SCOPE, queued.exportId);
    const after = await status.status(world.ctx, SCOPE, queued.exportId);

    // Assert
    expect(before.downloadUrl).toBeNull();
    expect(after.downloadUrl).toContain(`/exports/${queued.exportId}/file?name=products-${queued.exportId}.csv`);
  });
});
