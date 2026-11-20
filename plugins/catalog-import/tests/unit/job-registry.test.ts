import { SemaphoreBusyError } from '@cod/plugin-platform-jobs';
import { IMPORTS_EXPORTS_JOB_KINDS } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../application/ports/operation-context';
import { IMPORTS_EXPORTS_QUEUE, JOB_ERROR_CODES } from '../../domain/constants';
import type { ImportsExportsJobData } from '../../domain/imports-exports-job';
import type { OpenedJob } from '../../infrastructure/job-store-context';
import { ImportsExportsJobRegistry } from '../../infrastructure/job-registry';
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
  ref: { table: 'export', id: '7302' },
  actorAdministratorId: 5,
};

function registryWith(options: { busy?: boolean; opened?: OpenedJob | undefined } = {}) {
  const semaphore = {
    withBusinessSemaphore: vi.fn(async (_key: unknown, _limit: number, work: () => Promise<void>): Promise<void> => {
      if (options.busy === true) throw new SemaphoreBusyError(1_000);
      await work();
    }),
  };
  const queues = { requeueWithDelay: vi.fn(() => Promise.resolve()) };
  const stores = { open: vi.fn(() => Promise.resolve('opened' in options ? options.opened : OPENED)) };
  const jobs = new FakeJobs();
  const logger = new RecordingLogger();
  const registry = new ImportsExportsJobRegistry({ semaphore, queues, stores, jobs, logger, random: () => 0.5 });
  return { registry, semaphore, queues, stores, jobs, logger };
}

describe('ImportsExportsJobRegistry (D2212)', () => {
  it('dispatches by kind', async () => {
    // Arrange
    const { registry, semaphore } = registryWith();
    const importHandler = vi.fn(() => Promise.resolve());
    const exportHandler = vi.fn(() => Promise.resolve());
    registry.register(K.productImport, importHandler);
    registry.register(K.productExport, exportHandler);
    const data = dataOf(K.productExport);

    // Act
    await registry.run(data, FIRST_RUN);

    // Assert
    expect(exportHandler).toHaveBeenCalledWith(data, OPENED.ctx, SCOPE);
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

  it('logs and drops a kind no handler serves', async () => {
    // Arrange
    const { registry, stores, logger } = registryWith();

    // Act
    await registry.run(dataOf('order-export'), FIRST_RUN);

    // Assert
    expect(stores.open).not.toHaveBeenCalled();
    expect(logger.errors).toHaveLength(1);
  });

  it('a handler failing on its last attempt fails the job row and rethrows', async () => {
    // Arrange
    const { registry, jobs } = registryWith();
    registry.register(K.productExport, () => Promise.reject(new Error('boom')));

    // Act and Assert
    await expect(registry.run(dataOf(K.productExport), FIRST_RUN)).rejects.toThrow('boom');
    expect(jobs.failed).toEqual([]);
    await expect(registry.run(dataOf(K.productExport), LAST_RUN)).rejects.toThrow('boom');
    expect(jobs.failed).toMatchObject([{ ref: OPENED.ref, failure: { errorCode: JOB_ERROR_CODES.FAILED } }]);
  });
});
