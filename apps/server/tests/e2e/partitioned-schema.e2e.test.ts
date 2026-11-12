import { ACTIVITY_LOG_SCHEMA } from '@cod/plugin-rbac';
import { INBOUND_WEBHOOK_SCHEMAS } from '@cod/plugin-platform-webhooks';
import { OUTBOX_SCHEMAS } from '@cod/plugin-platform-outbox';
import {
  type EntityMetadataLike,
  findUniqueIndexesWithoutPartitionKey,
  PartitionRegistry,
  partitionName,
  type PartitionPolicy,
} from '@cod/plugin-platform-partitions';
import type { PartitionedTableSchema } from '@cod/shared';
import { bootstrapWorker, TransactionalConnection } from '@vendure/core';
import type { INestApplicationContext } from '@nestjs/common';
import type { Client } from 'pg';
import type { EntityMetadata } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppEnv, loadEnv } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';
import { runMigrate } from '../../src/roles/migrate.role';
import { type CatalogColumn, catalogColumns } from './support/schema-catalog';
import { connectTo, createDatabase, dropDatabase } from './support/test-database';

const DATABASE_NAME = `cod_partschema_${String(process.pid)}`;
const CHECK_SCHEMA = 'schema_check';
/** The tables this session partitions: the outbox pair, the inbound webhooks and the activity log. */
const PARTITIONED_TABLES = ['activity_log', 'inbound_webhook', 'outbox_delivery', 'outbox_event'];
const SCHEMAS: readonly PartitionedTableSchema[] = [...OUTBOX_SCHEMAS, ...INBOUND_WEBHOOK_SCHEMAS, ACTIVITY_LOG_SCHEMA];
const DAY_MS = 86_400_000;
const DAYS_AHEAD = 7;

/** The unique indexes of the partitioned tables whose key lacks the partition column, read from `pg_index`. */
const UNIQUE_WITHOUT_KEY_SQL = `
  SELECT c.relname || ': ' || i.relname AS finding
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index x ON x.indrelid = c.oid AND x.indisunique
    JOIN pg_class i ON i.oid = x.indexrelid
   WHERE n.nspname = 'public' AND c.relname = ANY($1)
     AND NOT EXISTS (
       SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attname = ($2::jsonb ->> c.relname) AND a.attnum = ANY (x.indkey::int2[]))
   ORDER BY 1`;

/** The columns of the entity behind `table`, as the database reports them (`character varying(64)`, ...). */
function entityColumns(metadata: EntityMetadata): CatalogColumn[] {
  const driver = metadata.connection.driver;
  return metadata.columns.map((column) => {
    const type = driver.normalizeType(column);
    const length = driver.getColumnLength(column);
    return {
      name: column.databaseName,
      type: length === '' ? type : `${type}(${length})`,
      notNull: !column.isNullable,
      default: null,
    };
  });
}

/** Entities do not describe database defaults the way `pg_attrdef` does, so the entity comparison leaves them out. */
const withoutDefault = ({ name, type, notNull }: CatalogColumn): Omit<CatalogColumn, 'default'> => ({
  name,
  type,
  notNull,
});

const sorted = (columns: CatalogColumn[]): CatalogColumn[] => [...columns].sort((a, b) => a.name.localeCompare(b.name));

describe('partitioned schema', () => {
  let env: AppEnv;
  let url: string;
  let client: Client;
  let app: INestApplicationContext;
  let policies: readonly PartitionPolicy[];
  let metadatas: readonly EntityMetadata[];
  /** The instant just before the migrate role ran: the partitions it premakes are counted from this date. */
  let migratedAt: Date;

  beforeAll(async () => {
    url = await createDatabase(DATABASE_NAME);
    env = loadEnv({ ...process.env, DATABASE_URL: url, DATABASE_URL_DIRECT: url });
    migratedAt = new Date();
    await runMigrate(env);
    client = await connectTo(url);
    const worker = await bootstrapWorker(buildVendureConfig(env, 'migrate'));
    app = worker.app;
    policies = app.get(PartitionRegistry).policies();
    metadatas = app.get(TransactionalConnection).rawConnection.entityMetadatas;
  });

  afterAll(async () => {
    await app.close();
    await client.end();
    await dropDatabase(DATABASE_NAME);
  });

  it('partitions exactly the four tables of the session, each by RANGE on its policy column', async () => {
    const { rows } = await client.query<{ table: string; strategy: string; column: string }>(
      `SELECT c.relname AS "table", pt.partstrat AS strategy, a.attname AS "column"
         FROM pg_partitioned_table pt
         JOIN pg_class c ON c.oid = pt.partrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = pt.partattrs[0]
        WHERE n.nspname = 'public' ORDER BY c.relname`,
    );

    expect(rows.map((row) => row.table)).toEqual(PARTITIONED_TABLES);
    expect(policies.map((policy) => policy.table).sort()).toEqual(PARTITIONED_TABLES);
    for (const row of rows) {
      expect(row.strategy, row.table).toBe('r');
      expect(row.column, row.table).toBe(policies.find((policy) => policy.table === row.table)?.column);
    }
  });

  it('has the columns and types of the entity of each table', async () => {
    for (const table of PARTITIONED_TABLES) {
      const metadata = metadatas.find((candidate) => candidate.tableName === table);
      expect(metadata, `entity of ${table}`).toBeDefined();
      const actual = await catalogColumns(client, 'public', table);

      expect(sorted(actual).map(withoutDefault), table).toEqual(
        sorted(entityColumns(metadata as EntityMetadata)).map(withoutDefault),
      );
    }
  });

  it('is what the *_SCHEMAS constants create: columns, defaults, indexes and triggers', async () => {
    await client.query(`CREATE SCHEMA ${CHECK_SCHEMA}`);
    try {
      await client.query(`SET search_path TO ${CHECK_SCHEMA}`);
      for (const schema of SCHEMAS) {
        await client.query(schema.createSql);
      }
      await client.query('SET search_path TO public');
      const indexes = async (schema: string, table: string): Promise<string[]> =>
        (
          await client.query<{ definition: string }>(
            `SELECT replace(indexdef, $3, '') AS definition FROM pg_indexes
              WHERE schemaname = $1 AND tablename = $2 ORDER BY indexname`,
            [schema, table, `${schema}.`],
          )
        ).rows.map((row) => row.definition);

      const triggers = async (schema: string, table: string): Promise<string[]> =>
        (
          await client.query<{ definition: string }>(
            `SELECT replace(pg_get_triggerdef(t.oid), $3, '') AS definition
               FROM pg_trigger t
               JOIN pg_class c ON c.oid = t.tgrelid
               JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = $1 AND c.relname = $2 AND NOT t.tgisinternal ORDER BY t.tgname`,
            [schema, table, `${schema}.`],
          )
        ).rows.map((row) => row.definition);

      for (const schema of SCHEMAS) {
        expect(await catalogColumns(client, CHECK_SCHEMA, schema.table), schema.table).toEqual(
          await catalogColumns(client, 'public', schema.table),
        );
        expect(await indexes(CHECK_SCHEMA, schema.table), schema.table).toEqual(await indexes('public', schema.table));
        const created = await triggers(CHECK_SCHEMA, schema.table);
        if (schema.table === 'activity_log') {
          // The comparison below would also pass if both sides lost the trigger: pin that it is there.
          expect(created.some((definition) => definition.includes('activity_log_append_only'))).toBe(true);
        }
        expect(created, schema.table).toEqual(await triggers('public', schema.table));
      }
    } finally {
      await client.query('SET search_path TO public');
      await client.query(`DROP SCHEMA ${CHECK_SCHEMA} CASCADE`);
    }
  });

  it('has no DEFAULT partition', async () => {
    const { rows } = await client.query<{ parent: string; child: string }>(
      `SELECT p.relname AS parent, c.relname AS child
         FROM pg_inherits i
         JOIN pg_class p ON p.oid = i.inhparent
         JOIN pg_class c ON c.oid = i.inhrelid
        WHERE p.relname = ANY($1) AND pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT'`,
      [PARTITIONED_TABLES],
    );

    expect(rows).toEqual([]);
  });

  it('has the partitions from today to today + 7 after the migrate role maintained them', async () => {
    const now = migratedAt;
    const expected = policies.flatMap((policy) => {
      if (policy.interval === 'month') {
        return [partitionName(policy.table, 'month', new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))];
      }
      const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      return Array.from({ length: DAYS_AHEAD + 1 }, (_, offset) =>
        partitionName(policy.table, 'day', new Date(today + offset * DAY_MS)),
      );
    });
    const { rows } = await client.query<{ name: string }>(
      `SELECT c.relname AS name FROM pg_inherits i
         JOIN pg_class p ON p.oid = i.inhparent JOIN pg_class c ON c.oid = i.inhrelid
        WHERE p.relname = ANY($1)`,
      [PARTITIONED_TABLES],
    );

    // A run that straddles midnight UTC may see one more day than it asked for; none may be missing.
    expect(rows.map((row) => row.name)).toEqual(expect.arrayContaining(expected));
  });

  describe('unique indexes without the partition key', () => {
    const partitionColumns = (): Map<string, string> =>
      new Map(policies.map((policy) => [policy.table, policy.column]));

    it('are reported by the rule over every registered entity: none today', () => {
      const entities: EntityMetadataLike[] = metadatas.map((metadata) => metadata);

      expect(findUniqueIndexesWithoutPartitionKey(entities, partitionColumns())).toEqual([]);
    });

    it('are reported by the same rule over pg_index: none today', async () => {
      const keys = JSON.stringify(Object.fromEntries(partitionColumns()));

      const { rows } = await client.query<{ finding: string }>(UNIQUE_WITHOUT_KEY_SQL, [PARTITIONED_TABLES, keys]);

      expect(rows).toEqual([]);
    });

    // Positive controls: a check that cannot fail proves nothing.
    it('the metadata rule fires on a fixture entity whose primary key leaves the partition column out', () => {
      const fixture: EntityMetadataLike = {
        tableName: 'outbox_event',
        primaryColumns: [{ databaseName: 'id' }],
        indices: [{ name: 'UQ_fixture', isUnique: true, columns: [{ databaseName: 'dedupeKey' }] }],
        uniques: [],
      };

      expect(findUniqueIndexesWithoutPartitionKey([fixture], partitionColumns())).toEqual([
        'outbox_event: primary key',
        'outbox_event: UQ_fixture',
      ]);
    });

    it('the pg_index query fires when the claimed partition column is not in the key', async () => {
      const keys = JSON.stringify({ outbox_event: 'status' });

      const { rows } = await client.query<{ finding: string }>(UNIQUE_WITHOUT_KEY_SQL, [['outbox_event'], keys]);

      expect(rows).toEqual([{ finding: 'outbox_event: outbox_event_pkey' }]);
    });
  });
});
