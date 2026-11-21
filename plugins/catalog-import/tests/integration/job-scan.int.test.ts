import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import type { JobScanPort } from '../../application/ports/job-repository.port';
import { JOB_SCAN } from '../../application/tokens';
import { REQUEUE_JOB_STATUSES } from '../../domain/job-kinds';
import { importSuite, type PlantedJob } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const NOW = new Date();
const minutesAgo = (minutes: number): Date => new Date(NOW.getTime() - minutes * 60_000);

/** Plants a row and backdates it, as a job the worker lost would look. */
async function planted(job: PlantedJob, updatedAt: Date): Promise<string> {
  const id = await suite.kit.plantJob(job);
  await suite.kit.query(`UPDATE "${job.table}" SET "updatedAt" = $1 WHERE "id" = $2`, [updatedAt, id]);
  return id;
}

describe('the job scan across businesses (D2212)', () => {
  it('finds lost and stalled rows of both tables and every business, oldest first, and pages after a cursor', async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    const inA = { businessId: a.businessId, storeId: a.stores[0].id };
    const inB = { businessId: b.businessId, storeId: b.stores[0].id };
    const lostImport = await planted({ table: 'catalog_import_job', ...inA, status: 'confirming' }, minutesAgo(5));
    const lostExport = await planted({ table: 'catalog_export_job', ...inB, status: 'queued' }, minutesAgo(4));
    const stalled = await planted({ table: 'catalog_import_job', ...inB, status: 'running' }, minutesAgo(40));
    await planted({ table: 'catalog_import_job', ...inA, status: 'confirming' }, minutesAgo(1));
    await planted({ table: 'catalog_export_job', ...inA, status: 'running' }, minutesAgo(10));
    await planted({ table: 'catalog_import_job', ...inA, status: 'previewed' }, minutesAgo(60));
    await planted({ table: 'catalog_export_job', ...inB, status: 'done' }, minutesAgo(60));
    const scan = suite.kit.app.get<JobScanPort>(JOB_SCAN);
    const query = {
      limit: 10,
      requeueBefore: minutesAgo(2),
      failBefore: minutesAgo(30),
      requeueStatuses: REQUEUE_JOB_STATUSES,
    };

    // Act
    const due = await scan.dueJobs(query);
    const [first] = due;
    const after = first === undefined ? [] : await scan.dueJobs({ ...query, after: { ...first } });

    // Assert
    expect(due.map((row) => [row.table, row.id, row.businessId, row.status])).toEqual([
      ['import', stalled, b.businessId, 'running'],
      ['import', lostImport, a.businessId, 'confirming'],
      ['export', lostExport, b.businessId, 'queued'],
    ]);
    expect(after.map((row) => row.id)).toEqual([lostImport, lostExport]);
  });

  it('pages rows of one time by numeric id, even when the ids differ in digit count', async () => {
    // Arrange: text order would put '10' before '9'
    const { a } = suite.fixtures;
    const inA = { businessId: a.businessId, storeId: a.stores[0].id };
    const at = minutesAgo(50);
    await planted({ table: 'catalog_import_job', ...inA, status: 'confirming', id: '9' }, at);
    await planted({ table: 'catalog_import_job', ...inA, status: 'confirming', id: '10' }, at);
    const scan = suite.kit.app.get<JobScanPort>(JOB_SCAN);
    const query = {
      limit: 1,
      requeueBefore: minutesAgo(45),
      failBefore: minutesAgo(45),
      requeueStatuses: REQUEUE_JOB_STATUSES,
    };

    // Act
    const [first] = await scan.dueJobs(query);
    const second = first === undefined ? [] : await scan.dueJobs({ ...query, after: { ...first } });

    // Assert
    expect(first?.id).toBe('9');
    expect(second.map((row) => row.id)).toEqual(['10']);
  });

  it("reads a row's scope, status and actor by id, and nothing for a malformed or unknown id", async () => {
    // Arrange
    const { a } = suite.fixtures;
    const id = await suite.kit.plantJob({
      table: 'catalog_export_job',
      businessId: a.businessId,
      storeId: a.stores[0].id,
      status: 'queued',
    });
    const scan = suite.kit.app.get<JobScanPort>(JOB_SCAN);

    // Act
    const found = await scan.rowScopeOf({ table: 'export', id });
    const wrongTable = await scan.rowScopeOf({ table: 'import', id });
    const malformed = await scan.rowScopeOf({ table: 'export', id: "1' OR '1'='1" });

    // Assert
    expect(found).toEqual({
      businessId: a.businessId,
      storeId: a.stores[0].id,
      status: 'queued',
      actorAdministratorId: null,
    });
    expect([wrongTable, malformed]).toEqual([undefined, undefined]);
  });
});
