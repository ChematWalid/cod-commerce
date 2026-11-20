import { SemaphoreBusyError } from '@cod/plugin-platform-jobs';
import { IMPORTS_EXPORTS_JOB_KINDS } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../application/ports/operation-context';
import { IMPORTS_EXPORTS_QUEUE, JOB_ERROR_CODES } from '../../domain/constants';
import type { ImportsExportsJobData } from '../../domain/imports-exports-job';
import type { JobRowScope, JobRowSource } from '../../application/ports/job-repository.port';
import { registrarOf } from '../../infrastructure/job-registrar';
import { ImportsExportsJobRegistry } from '../../infrastructure/job-registry';
import { ownRowSourceOf } from '../../infrastructure/job-row-sources';
import { JobStoreContext, type OpenedJob } from '../../infrastructure/job-store-context';
import { FakeJobs, RecordingLogger } from '../fakes/fake-jobs';
import { SCOPE } from '../support/scope';

const K = IMPORTS_EXPORTS_JOB_KINDS;
const FIRST_RUN = { attempts: 1, retries: 1 };
const LAST_RUN = { attempts: 2, retries: 1 };

const dataOf = (kind: string): ImportsExportsJobData => ({
  jobId: 'cex-7302',
  kind,
  recordId: '7302',
  businessId: '11',
  storeId: '22',
});

const OPENED: OpenedJob = {
  ctx: asOperationContext({ channel: 'store-22' }),
  scope: SCOPE,
  recordId: '7302',
  actorAdministratorId: 5,
};

/** A semaphore that is free, or busy when asked. */
const semaphoreOf = (busy = false) => ({
  withBusinessSemaphore: vi.fn(async (_key: unknown, _limit: number, work: () => Promise<void>): Promise<void> => {
    if (busy) throw new SemaphoreBusyError(1_000);
    await work();
  }),
});

function registryWith(options: { busy?: boolean; opened?: OpenedJob | undefined } = {}) {
  const semaphore = semaphoreOf(options.busy);
  const queues = { requeueWithDelay: vi.fn(() => Promise.resolve()) };
  const stores = { open: vi.fn(() => Promise.resolve('opened' in options ? options.opened : OPENED)) };
  const jobs = new FakeJobs();
  const logger = new RecordingLogger();
  const ownRows = (kind: string) => ownRowSourceOf(kind, { scan: jobs, jobs });
  const registry = new ImportsExportsJobRegistry({ semaphore, queues, stores, ownRows, logger, random: () => 0.5 });
  return { registry, semaphore, queues, stores, jobs, logger };
}

/** A row source another plugin brings for its own table, holding one queued row of business 11, store 22. */
function foreignRows(): JobRowSource & { failed: string[] } {
  const row: JobRowScope = { businessId: '11', storeId: '22', status: 'queued', actorAdministratorId: 8 };
  const failed: string[] = [];
  return {
    failed,
    rowScopeOf: (recordId) => Promise.resolve(recordId === '7401' ? row : undefined),
    markFailed: (_scope, recordId) => {
      failed.push(recordId);
      return Promise.resolve();
    },
  };
}

describe('ImportsExportsJobRegistry (D2212, D2252)', () => {
  it('dispatches by kind', async () => {
    // Arrange
    const { registry, semaphore, stores } = registryWith();
    const importHandler = vi.fn(() => Promise.resolve());
    const exportHandler = vi.fn(() => Promise.resolve());
    registry.register(K.productImport, importHandler);
    registry.register(K.productExport, exportHandler);
    const data = dataOf(K.productExport);

    // Act
    await registry.run(data, FIRST_RUN);

    // Assert
    expect(exportHandler).toHaveBeenCalledWith(data, OPENED.ctx, SCOPE);
    expect(stores.open).toHaveBeenCalledWith(data, expect.anything(), false);
    expect(importHandler).not.toHaveBeenCalled();
    expect(semaphore.withBusinessSemaphore).toHaveBeenCalledWith(
      { queue: IMPORTS_EXPORTS_QUEUE, businessId: '11' },
      1,
      expect.any(Function),
    );
  });

  it('refuses a second handler for a kind', () => {
    // Arrange
    const { registry } = registryWith();
    registry.register(K.productImport, () => Promise.resolve());

    // Act and Assert
    expect(() => {
      registry.register(K.productImport, () => Promise.resolve());
    }).toThrow(/product-import/);
  });

  it('requeues with delay when the business semaphore is busy', async () => {
    // Arrange
    const { registry, queues, stores } = registryWith({ busy: true });
    const handler = vi.fn(() => Promise.resolve());
    registry.register(K.productExport, handler);
    const data = dataOf(K.productExport);

    // Act
    await registry.run(data, FIRST_RUN);

    // Assert
    expect(handler).not.toHaveBeenCalled();
    expect(stores.open).not.toHaveBeenCalled();
    expect(queues.requeueWithDelay).toHaveBeenCalledWith(IMPORTS_EXPORTS_QUEUE, data, 17_500);
  });

  it('runs no handler when the job could not be opened', async () => {
    // Arrange
    const { registry } = registryWith({ opened: undefined });
    const handler = vi.fn(() => Promise.resolve());
    registry.register(K.productExport, handler);

    // Act
    await registry.run(dataOf(K.productExport), FIRST_RUN);

    // Assert
    expect(handler).not.toHaveBeenCalled();
  });

  it('refuses a kind catalog-import stores no row of, unless it brings a row source', () => {
    // Arrange
    const { registry } = registryWith();

    // Act and Assert
    expect(() => {
      registry.register('order-export', () => Promise.resolve());
    }).toThrow(/row source/);
    expect(() => {
      registry.register('order-export', () => Promise.resolve(), foreignRows());
    }).not.toThrow();
  });

  it('a foreign kind registered through the registrar runs its handler in its own row scope', async () => {
    // Arrange: the real store context, so the kind's own row source is what opens the job
    const storeCtx = asOperationContext({ channel: 'store-22' });
    const catalog = { storeContext: vi.fn(() => Promise.resolve(storeCtx)) };
    const logger = new RecordingLogger();
    const jobs = new FakeJobs();
    const registry = new ImportsExportsJobRegistry({
      semaphore: semaphoreOf(),
      queues: { requeueWithDelay: vi.fn(() => Promise.resolve()) },
      stores: new JobStoreContext({ catalog, logger }),
      ownRows: (kind) => ownRowSourceOf(kind, { scan: jobs, jobs }),
      logger,
    });
    const rows = foreignRows();
    const handler = vi.fn(() => Promise.reject(new Error('boom')));
    registrarOf(registry).register('order-export', handler, rows);
    const data = { jobId: 'oex-7401', kind: 'order-export', recordId: '7401', businessId: '11', storeId: '22' };

    // Act
    await expect(registry.run(data, LAST_RUN)).rejects.toThrow('boom');

    // Assert
    expect(handler).toHaveBeenCalledWith(data, storeCtx, SCOPE);
    expect(catalog.storeContext).toHaveBeenCalledWith(SCOPE);
    expect(rows.failed).toEqual(['7401']);
    expect(jobs.failed).toEqual([]);
    expect(logger.errors).toEqual([]);
  });

  it('a malformed payload business id is logged as such, not as a missing handler', async () => {
    // Arrange
    const { registry, stores, logger } = registryWith();
    registry.register(K.productExport, () => Promise.resolve());

    // Act
    await registry.run({ ...dataOf(K.productExport), businessId: 'abc' }, FIRST_RUN);

    // Assert
    expect(stores.open).not.toHaveBeenCalled();
    expect(logger.errors).toEqual([expect.stringMatching(/business id is malformed/)]);
  });

  it('logs and drops a kind no handler serves', async () => {
    // Arrange
    const { registry, stores, logger } = registryWith();

    // Act
    await registry.run(dataOf('order-export'), FIRST_RUN);

    // Assert
    expect(stores.open).not.toHaveBeenCalled();
    expect(logger.errors).toEqual([expect.stringMatching(/no handler for its kind/)]);
  });

  it('a handler failing on its last attempt fails the job row and rethrows', async () => {
    // Arrange
    const { registry, jobs } = registryWith();
    registry.register(K.productExport, () => Promise.reject(new Error('boom')));

    // Act and Assert
    await expect(registry.run(dataOf(K.productExport), FIRST_RUN)).rejects.toThrow('boom');
    expect(jobs.failed).toEqual([]);
    await expect(registry.run(dataOf(K.productExport), LAST_RUN)).rejects.toThrow('boom');
    expect(jobs.failed).toMatchObject([
      { ref: { table: 'export', id: OPENED.recordId }, failure: { errorCode: JOB_ERROR_CODES.FAILED } },
    ]);
  });
});
