import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { JOB_REPOSITORY } from '../../application/tokens';
import type { JobRepositoryPort } from '../../application/ports/job-repository.port';
import { JOB_ERROR_CODES } from '../../domain/constants';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

describe('catalog-import faults keep internal text out of stored rows (D2136, D2210)', () => {
  it('a failed job stores only its fixed error code', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const id = await suite.kit.plantJob({
      table: 'catalog_import_job',
      businessId: a.businessId,
      storeId: a.stores[0].id,
      status: 'running',
    });
    const jobs = suite.kit.app.get<JobRepositoryPort>(JOB_REPOSITORY);
    const scope = { businessId: toBusinessId(a.businessId), storeId: toStoreId(a.stores[0].id) };

    // Act
    await jobs.markFailed(scope, { table: 'import', id }, { errorCode: JOB_ERROR_CODES.STALLED, at: new Date() });

    // Assert
    expect(await suite.kit.jobRow('catalog_import_job', id)).toEqual({
      status: 'failed',
      errorCode: JOB_ERROR_CODES.STALLED,
    });
  });

  it('a job already done is never turned failed', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const id = await suite.kit.plantJob({
      table: 'catalog_export_job',
      businessId: a.businessId,
      storeId: a.stores[0].id,
      status: 'done',
    });
    const jobs = suite.kit.app.get<JobRepositoryPort>(JOB_REPOSITORY);
    const scope = { businessId: toBusinessId(a.businessId), storeId: toStoreId(a.stores[0].id) };

    // Act
    await jobs.markFailed(scope, { table: 'export', id }, { errorCode: JOB_ERROR_CODES.STALLED, at: new Date() });

    // Assert
    expect(await suite.kit.jobRow('catalog_export_job', id)).toEqual({ status: 'done', errorCode: null });
  });
});
