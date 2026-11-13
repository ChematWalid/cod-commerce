import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { PartitionMaintenanceService } from '@cod/plugin-platform-partitions';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACTIVITY_LOG_ARCHIVE_PENDING_REASON } from '../../infrastructure/activity-log-partition-policy';
import { ACTIVITY_LOG_TABLE } from '../../infrastructure/activity-log-schema';
import { ACTIVITY_LOG_QUERY, type Filters, type Page } from './activity-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1012;
const APPEND_ONLY_MESSAGE = 'activity_log is append-only';
const RAISE_EXCEPTION_STATE = 'P0001';
const MONTH_ACTION = 'month.row';

describe('activity_log partitioning, retention and append-only', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let nextId = 9_000_000_000_000_000n;

  const dataSource = () => server.app.get(TransactionalConnection).rawConnection;
  const maintain = (iso: string) => server.app.get(PartitionMaintenanceService).maintain(new Date(iso));

  const partitions = async (): Promise<string[]> => {
    const rows: { relname: string }[] = await dataSource().query(
      `SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
        WHERE i.inhparent = '${ACTIVITY_LOG_TABLE}'::regclass ORDER BY c.relname`,
    );
    return rows.map((row) => row.relname);
  };

  const insertRow = async (businessId: string, createdAt: string, action = 'seed.row'): Promise<string> => {
    nextId += 1n;
    const id = nextId.toString();
    await dataSource().query(
      `INSERT INTO ${ACTIVITY_LOG_TABLE} ("businessId", "id", "action", "entityType", "entityId", "summary", "diff", "createdAt")
       VALUES ($1, $2::bigint, $3, 'seed', $2::text, 'Seeded', '{}', $4)`,
      [businessId, id, action, createdAt],
    );
    return id;
  };

  const sqlStateOf = async (work: Promise<unknown>): Promise<{ state?: string; message?: string }> => {
    try {
      await work;
    } catch (error) {
      const driver = (error as { driverError?: { code?: string; message?: string } }).driverError;
      return { state: driver?.code, message: driver?.message };
    }
    return {};
  };

  const list = async (filters: Filters): Promise<Page['activityLog']> =>
    (await adminClient.query<Page>(ACTIVITY_LOG_QUERY, { input: filters })).activityLog;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('makes the current month and three more, and never a DEFAULT partition', async () => {
    // Act
    await maintain('2030-03-10T00:00:00.000Z');

    // Assert
    const names = await partitions();
    expect(names).toEqual(
      expect.arrayContaining([
        'activity_log_p203003',
        'activity_log_p203004',
        'activity_log_p203005',
        'activity_log_p203006',
      ]),
    );
    const defaults: { bound: string }[] = await dataSource().query(
      `SELECT pg_get_expr(c.relpartbound, c.oid) AS bound FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
        WHERE i.inhparent = '${ACTIVITY_LOG_TABLE}'::regclass`,
    );
    expect(defaults.filter((row) => row.bound === 'DEFAULT')).toEqual([]);
  });

  it('is partitioned by range with the key in the primary key', async () => {
    // Act
    const rows: { strategy: string; pk: string }[] = await dataSource().query(
      `SELECT p.partstrat AS strategy,
              (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = p.partrelid AND contype = 'p') AS pk
         FROM pg_partitioned_table p WHERE p.partrelid = '${ACTIVITY_LOG_TABLE}'::regclass`,
    );

    // Assert
    expect(rows[0]?.strategy).toBe('r');
    expect(rows[0]?.pk).toBe('PRIMARY KEY ("createdAt", id)');
  });

  it('accepts an insert, and refuses UPDATE and DELETE with the append-only error', async () => {
    // Arrange
    const businessId = businesses.a.businessId;
    const id = await insertRow(businessId, '2030-03-11T10:00:00.000Z');

    // Act
    const update = await sqlStateOf(
      dataSource().query(`UPDATE ${ACTIVITY_LOG_TABLE} SET "summary" = 'changed' WHERE "id" = $1`, [id]),
    );
    const remove = await sqlStateOf(dataSource().query(`DELETE FROM ${ACTIVITY_LOG_TABLE} WHERE "id" = $1`, [id]));

    // Assert
    expect(update.state).toBe(RAISE_EXCEPTION_STATE);
    expect(update.message).toContain(APPEND_ONLY_MESSAGE);
    expect(remove.state).toBe(RAISE_EXCEPTION_STATE);
    expect(remove.message).toContain(APPEND_ONLY_MESSAGE);
    const rows: { summary: string }[] = await dataSource().query(
      `SELECT "summary" FROM ${ACTIVITY_LOG_TABLE} WHERE "id" = $1`,
      [id],
    );
    expect(rows).toEqual([{ summary: 'Seeded' }]);
  });

  it('pages by id across two months without gap or duplicate', async () => {
    // Arrange
    await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);
    const inserted = [
      await insertRow(businesses.a.businessId, '2030-03-30T10:00:00.000Z', MONTH_ACTION),
      await insertRow(businesses.a.businessId, '2030-04-02T10:00:00.000Z', MONTH_ACTION),
      await insertRow(businesses.a.businessId, '2030-03-31T23:00:00.000Z', MONTH_ACTION),
      await insertRow(businesses.a.businessId, '2030-04-03T10:00:00.000Z', MONTH_ACTION),
    ];

    // Act
    const first = await list({ first: 3, action: MONTH_ACTION });
    const second = await list({ first: 3, after: first.nextCursor ?? undefined, action: MONTH_ACTION });

    // Assert
    const seen = [...first.items, ...second.items].map((item) => item.entityId);
    expect(seen).toEqual([...inserted].reverse());
    expect(second.nextCursor).toBeNull();
  });

  it('keeps business B rows out of business A listings, with a positive control for B', async () => {
    // Arrange
    const idB = await insertRow(businesses.b.businessId, '2030-04-04T10:00:00.000Z', 'isolation.row');
    await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);

    // Act
    const asA = await list({ action: 'isolation.row' });
    await actAs(adminClient, businesses.b.owner, businesses.b.stores[0]);
    const asB = await list({ action: 'isolation.row' });

    // Assert
    expect(asA.items).toEqual([]);
    expect(asB.items.map((item) => item.entityId)).toEqual([idB]);
  });

  it('keeps the current month and 24 before it as live, not as kept-past-retention', async () => {
    // Act: March 2032 retains back to March 2030 inclusive
    const report = await maintain('2032-03-10T00:00:00.000Z');

    // Assert
    const keptNames = report.kept.map((entry) => entry.partition);
    expect(keptNames).not.toContain('activity_log_p203003');
    expect(keptNames).not.toContain('activity_log_p203004');
    expect(report.dropped).toEqual([]);
    expect(await partitions()).toContain('activity_log_p203003');
  });

  it('keeps the first partition past 24 months, with the archive reason, while no archive target exists', async () => {
    // Arrange: April 2032 puts March 2030 one month past the 24 retained
    const before = await partitions();
    const pastRetention = before.filter((name) => name.slice(-6) < '203004');

    // Act
    const report = await maintain('2032-04-10T00:00:00.000Z');

    // Assert: exactly the partitions that ended by 2030-04-01, none younger
    expect(pastRetention).toContain('activity_log_p203003');
    expect(report.kept).toEqual(
      pastRetention.map((partition) => ({ partition, reason: ACTIVITY_LOG_ARCHIVE_PENDING_REASON })),
    );
    expect(report.kept.map((entry) => entry.partition)).not.toContain('activity_log_p203004');
    expect(ACTIVITY_LOG_ARCHIVE_PENDING_REASON).toBe('archive target not built (ADR 0016: archive (security))');
    expect(report.dropped).toEqual([]);
    expect(await partitions()).toEqual(expect.arrayContaining(pastRetention));
  });

  it('lets TRUNCATE through, for test resets', async () => {
    // Act
    const result = await sqlStateOf(dataSource().query(`TRUNCATE ${ACTIVITY_LOG_TABLE}`));

    // Assert
    expect(result.state).toBeUndefined();
    const rows: { count: string }[] = await dataSource().query(`SELECT count(*) AS count FROM ${ACTIVITY_LOG_TABLE}`);
    expect(rows[0]?.count).toBe('0');
  });
});
