import { CATALOG_ERROR_CODES, DomainError, IMPORTS_EXPORTS_JOB_KINDS } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogProductsPort } from '../../application/ports/catalog-products.port';
import { asOperationContext } from '../../application/ports/operation-context';
import { JOB_ERROR_CODES } from '../../domain/constants';
import type { ImportsExportsJobData } from '../../domain/imports-exports-job';
import type { JobRowScope, JobRowSource } from '../../application/ports/job-repository.port';
import { tableRowSource } from '../../infrastructure/job-row-sources';
import { JobStoreContext } from '../../infrastructure/job-store-context';
import { FakeJobs, type FakeJobRow, RecordingLogger } from '../fakes/fake-jobs';

class StoreGoneError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
}

const ROW: FakeJobRow = {
  table: 'import',
  id: '7301',
  businessId: '11',
  storeId: '22',
  status: 'confirming',
  updatedAt: new Date('2026-11-15T10:00:00.000Z'),
  actorAdministratorId: 5,
};

const dataOf = (overrides: Partial<ImportsExportsJobData> = {}): ImportsExportsJobData => ({
  jobId: 'cim-7301',
  kind: IMPORTS_EXPORTS_JOB_KINDS.productImport,
  recordId: '7301',
  businessId: '11',
  storeId: '22',
  ...overrides,
});

function contextWith(storeContext: CatalogProductsPort['storeContext']) {
  const jobs = new FakeJobs([ROW]);
  const catalog = { storeContext: vi.fn(storeContext) };
  const logger = new RecordingLogger();
  const rows = tableRowSource('import', { scan: jobs, jobs });
  return { context: new JobStoreContext({ catalog, logger }), rows, jobs, catalog, logger };
}

const STORE_CTX = asOperationContext({ channel: 'store-22' });

describe('JobStoreContext (D2212, D2252)', () => {
  it("the scope comes from the job row, never the payload's client data", async () => {
    // Arrange
    const { context, rows, catalog } = contextWith(() => Promise.resolve(STORE_CTX));
    const data = { ...dataOf(), actorAdministratorId: 99 } as ImportsExportsJobData;

    // Act
    const opened = await context.open(data, rows, false);

    // Assert
    expect(catalog.storeContext).toHaveBeenCalledWith({ businessId: '11', storeId: '22' });
    expect(opened).toEqual({
      ctx: STORE_CTX,
      scope: { businessId: '11', storeId: '22' },
      recordId: '7301',
      actorAdministratorId: 5,
    });
  });

  it.each([
    ['business', { businessId: '33' }],
    ['store', { storeId: '44' }],
  ])('a payload whose %s differs from the row fails the job', async (_field, overrides) => {
    // Arrange
    const { context, rows, jobs, catalog } = contextWith(() => Promise.resolve(STORE_CTX));

    // Act
    const opened = await context.open(dataOf(overrides), rows, false);

    // Assert
    expect(opened).toBeUndefined();
    expect(catalog.storeContext).not.toHaveBeenCalled();
    expect(jobs.failed).toMatchObject([
      {
        scope: { businessId: '11', storeId: '22' },
        ref: { table: 'import', id: '7301' },
        failure: { errorCode: JOB_ERROR_CODES.SCOPE_MISMATCH },
      },
    ]);
  });

  it('an archived store fails the job', async () => {
    // Arrange
    const { context, rows, jobs } = contextWith(() => Promise.reject(new StoreGoneError('No such product')));

    // Act
    const opened = await context.open(dataOf(), rows, false);

    // Assert
    expect(opened).toBeUndefined();
    expect(jobs.failed).toMatchObject([{ failure: { errorCode: JOB_ERROR_CODES.STORE_UNAVAILABLE } }]);
  });

  it('a store context that fails for another reason is retried, nothing marked', async () => {
    // Arrange
    const { context, rows, jobs } = contextWith(() => Promise.reject(new Error('database down')));

    // Act and Assert
    await expect(context.open(dataOf(), rows, false)).rejects.toThrow('database down');
    expect(jobs.failed).toEqual([]);
  });

  it('a store context failing on the last attempt fails the row, then rethrows', async () => {
    // Arrange
    const { context, rows, jobs } = contextWith(() => Promise.reject(new Error('database down')));

    // Act and Assert
    await expect(context.open(dataOf(), rows, true)).rejects.toThrow('database down');
    expect(jobs.failed).toMatchObject([
      { ref: { table: 'import', id: '7301' }, failure: { errorCode: JOB_ERROR_CODES.FAILED } },
    ]);
  });

  it('opens a row another plugin stores through the row source it brought', async () => {
    // Arrange
    const { context } = contextWith(() => Promise.resolve(STORE_CTX));
    const foreignRow: JobRowScope = { businessId: '11', storeId: '22', status: 'queued', actorAdministratorId: 8 };
    const foreign: JobRowSource = {
      rowScopeOf: vi.fn((recordId: string) => Promise.resolve(recordId === '7401' ? foreignRow : undefined)),
      markFailed: vi.fn(() => Promise.resolve()),
    };

    // Act
    const opened = await context.open(
      dataOf({ kind: 'order-export', jobId: 'oex-7401', recordId: '7401' }),
      foreign,
      false,
    );

    // Assert
    expect(opened).toEqual({
      ctx: STORE_CTX,
      scope: { businessId: '11', storeId: '22' },
      recordId: '7401',
      actorAdministratorId: 8,
    });
  });

  it.each([
    ['no row of that id', dataOf({ recordId: '9999' })],
    ['a malformed record id', dataOf({ recordId: 'abc' })],
  ])('%s is logged and dropped', async (_name, data) => {
    // Arrange
    const { context, rows, jobs, catalog, logger } = contextWith(() => Promise.resolve(STORE_CTX));

    // Act
    const opened = await context.open(data, rows, false);

    // Assert
    expect(opened).toBeUndefined();
    expect(jobs.failed).toEqual([]);
    expect(catalog.storeContext).not.toHaveBeenCalled();
    expect(logger.errors).toHaveLength(1);
  });

  it('a row already done or failed is dropped without a mark', async () => {
    // Arrange
    const { context, rows, jobs } = contextWith(() => Promise.resolve(STORE_CTX));
    jobs.rows = [{ ...ROW, status: 'done' }];

    // Act and Assert
    expect(await context.open(dataOf(), rows, false)).toBeUndefined();
    expect(jobs.failed).toEqual([]);
  });
});
