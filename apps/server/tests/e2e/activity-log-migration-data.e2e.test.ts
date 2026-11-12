import { preBootstrapConfig, resetConfig } from '@vendure/core';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppEnv, loadEnv } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';
import { runMigrate } from '../../src/roles/migrate.role';
import { connectTo, createDatabase, dropDatabase } from './support/test-database';

const DATABASE_NAME = `cod_auditdata_${String(process.pid)}`;
const PARTITIONED_MIGRATION = 1794426900000;
const BUSINESS_A = '7500000000000000100';
const BUSINESS_B = '7500000000000000200';

const monthStart = (offset: number): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
};

const partitionOf = (at: Date): string =>
  `activity_log_p${String(at.getUTCFullYear())}${String(at.getUTCMonth() + 1).padStart(2, '0')}`;

interface SeedRow {
  readonly id: string;
  readonly businessId: string;
  readonly storeId: string | null;
  readonly createdAt: Date;
}

/** Rows of two businesses over seven months: month edges (first and last millisecond), a mid-month day, today. */
function seedRows(): SeedRow[] {
  const at = [
    monthStart(-6),
    new Date(monthStart(-5).getTime() - 1),
    monthStart(-5),
    new Date(monthStart(-4).getTime() + 15 * 86_400_000),
    monthStart(-2),
    new Date(monthStart(-1).getTime() - 1),
    new Date(Date.now() - 60_000),
  ];
  return at.map((createdAt, index) => ({
    id: String(7_500_000_000_000_000_001n + BigInt(index)),
    businessId: index % 2 === 0 ? BUSINESS_A : BUSINESS_B,
    storeId: index % 3 === 0 ? null : '7500000000000000300',
    createdAt,
  }));
}

/** Reverts newest first until no migration at or after `timestamp` is left. */
async function revertThrough(env: AppEnv, timestamp: number): Promise<void> {
  const config = await preBootstrapConfig(buildVendureConfig(env, 'migrate'));
  const dataSource = await new DataSource({ ...config.dbConnectionOptions, synchronize: false }).initialize();
  try {
    for (;;) {
      const [newest] = await dataSource.query<{ timestamp: string }[]>(
        'SELECT "timestamp" FROM migrations ORDER BY "timestamp"::bigint DESC LIMIT 1',
      );
      if (newest === undefined || Number(newest.timestamp) < timestamp) break;
      await dataSource.undoLastMigration({ transaction: 'each' });
    }
  } finally {
    await dataSource.destroy();
    resetConfig();
  }
}

// Audit RBAC-2 (D123): the conversion copies live audit rows, which an empty-database round trip never exercises.
describe('activity_log migration with rows', () => {
  let env: AppEnv;
  let url: string;
  const rows = seedRows();

  const read = async (table = 'activity_log'): Promise<Record<string, unknown>[]> => {
    const client = await connectTo(url);
    try {
      const result = await client.query(`SELECT * FROM "${table}" ORDER BY "id"`);
      return result.rows as Record<string, unknown>[];
    } finally {
      await client.end();
    }
  };

  const relkindOfLog = async (): Promise<string> => {
    const client = await connectTo(url);
    try {
      const result = await client.query(`SELECT "relkind" FROM pg_class WHERE "oid" = 'activity_log'::regclass`);
      return (result.rows as { relkind: string }[])[0]?.relkind ?? '';
    } finally {
      await client.end();
    }
  };

  const partitionsOfRows = async (): Promise<Record<string, string>> => {
    const client = await connectTo(url);
    try {
      const result = await client.query(`SELECT "id", tableoid::regclass::text AS part FROM "activity_log"`);
      return Object.fromEntries((result.rows as { id: string; part: string }[]).map((row) => [row.id, row.part]));
    } finally {
      await client.end();
    }
  };

  beforeAll(async () => {
    url = await createDatabase(DATABASE_NAME);
    env = loadEnv({ ...process.env, DATABASE_URL: url, DATABASE_URL_DIRECT: url });
  });

  afterAll(async () => {
    await dropDatabase(DATABASE_NAME);
  });

  it('keeps every row, in the partition of its month, through up and down', async () => {
    // Arrange: the schema just before the conversion, holding rows of two businesses
    await runMigrate(env);
    await revertThrough(env, PARTITIONED_MIGRATION);
    const client = await connectTo(url);
    try {
      for (const row of rows) {
        await client.query(
          `INSERT INTO "activity_log" ("businessId", "storeId", "id", "actorAdministratorId", "action", "entityType", "entityId", "summary", "diff", "ip", "userAgent", "createdAt")
           VALUES ($1, $2, $3, 1, 'test.action', 'Thing', 'thing-1', 'Synthetic row', '{"before":{"n":1},"after":{"n":2}}', '203.0.113.7', 'vitest', $4)`,
          [row.businessId, row.storeId, row.id, row.createdAt],
        );
      }
    } finally {
      await client.end();
    }
    const original = await read();
    expect(original).toHaveLength(rows.length);

    // Act: up (the migrate role)
    await runMigrate(env);

    // Assert: same values, each row in the partition named for its UTC month
    expect(await read()).toEqual(original);
    expect(await relkindOfLog()).toBe('p');
    const parts = await partitionsOfRows();
    for (const row of rows) {
      expect(parts[row.id], row.createdAt.toISOString()).toBe(partitionOf(row.createdAt));
    }

    // Act: down
    await revertThrough(env, PARTITIONED_MIGRATION);

    // Assert: every row is back in the plain table
    expect(await relkindOfLog()).toBe('r');
    expect(await read()).toEqual(original);
  });
});
