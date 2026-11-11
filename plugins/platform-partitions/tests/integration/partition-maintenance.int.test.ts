import { PlatformJobsPlugin, TaskHeartbeatReader } from '@cod/plugin-platform-jobs';
import {
  createPluginTestEnvironment,
  ensurePartitionedSchema,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
} from '@cod/testing';
import { Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Injector, Logger, PluginCommonModule, TransactionalConnection, VendurePlugin } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PartitionMaintenanceService } from '../../application/partition-maintenance.service';
import { PartitionRegistry } from '../../application/partition-registry';
import { PartitionRegistryClosedError } from '../../domain/errors';
import type { PartitionRef } from '../../domain/policy';
import { PlatformPartitionsPlugin } from '../../platform-partitions.plugin';
import { partitionMaintenanceTask } from '../../infrastructure/partition-maintenance.task';
import { PROBE_SCHEMA, PROBE_TABLE } from './probe-schema';

/** What the probe policy asks of the test, changed from one test to the next. */
const probe = {
  keep: ((): string | null => null) as (partition: PartitionRef) => string | null,
  scrubbed: [] as string[],
};

/** Registers the fixture policy in `onModuleInit`, as an owning plugin does (the registry closes at bootstrap). */
@VendurePlugin({ imports: [PluginCommonModule, PlatformPartitionsPlugin] })
class ProbePolicyPlugin {
  constructor(@Inject(PartitionRegistry) private readonly registry: PartitionRegistry) {}

  onModuleInit(): void {
    this.registry.register({
      table: PROBE_TABLE,
      column: 'createdAt',
      interval: 'day',
      premake: 7,
      retain: 7,
      keepIf: (partition) => Promise.resolve(probe.keep(partition)),
      scrub: {
        afterIntervals: 3,
        sql: (partitionTable) => {
          probe.scrubbed.push(partitionTable);
          return 'SELECT 1';
        },
      },
    });
  }
}

let clockMs = Date.parse('2030-05-01T02:00:00.000Z');
const { server } = createPluginTestEnvironment({
  db: loadPluginTestDbConfig(process.env),
  plugins: [
    PlatformJobsPlugin.init({
      redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6380',
      appEnv: 'test-platform-partitions',
      clock: { now: () => clockMs },
    }),
    PlatformPartitionsPlugin,
    ProbePolicyPlugin,
  ],
});

const dataSource = () => server.app.get(TransactionalConnection).rawConnection;
const maintain = (iso: string) => server.app.get(PartitionMaintenanceService).maintain(new Date(iso));
const name = (day: string): string => `${PROBE_TABLE}_p${day}`;
const days = (...ds: string[]): string[] => ds.map(name);

async function partitions(): Promise<string[]> {
  const rows: { relname: string }[] = await dataSource().query(
    `SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
      WHERE i.inhparent = '${PROBE_TABLE}'::regclass ORDER BY c.relname`,
  );
  return rows.map((row) => row.relname);
}

const insertAt = (iso: string) =>
  dataSource().query(`INSERT INTO ${PROBE_TABLE} (id, "createdAt") VALUES (1, '${iso}')`);

async function sqlStateOf(work: Promise<unknown>): Promise<string | undefined> {
  try {
    await work;
  } catch (error) {
    return (error as { driverError?: { code?: string } }).driverError?.code;
  }
  return undefined;
}

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  await ensurePartitionedSchema(dataSource(), [PROBE_SCHEMA]);
});

afterAll(async () => {
  await dataSource().query(`DROP TABLE IF EXISTS ${PROBE_TABLE}`);
  await server.destroy();
});

describe('partition maintenance', () => {
  it('leaves an existing partitioned table alone when the schema is ensured again', async () => {
    // Act
    const again = ensurePartitionedSchema(dataSource(), [PROBE_SCHEMA]);

    // Assert
    await expect(again).resolves.toBeUndefined();
    const found: { found: string | null }[] = await dataSource().query('SELECT to_regclass($1) AS found', [
      PROBE_TABLE,
    ]);
    expect(found[0]?.found).toBe(PROBE_TABLE);
  });

  it('creates the current day and seven more, and none on a second run', async () => {
    // Act
    const first = await maintain('2030-03-10T00:00:00.000Z');
    const second = await maintain('2030-03-10T00:00:00.000Z');

    // Assert
    const expected = days(
      '20300310',
      '20300311',
      '20300312',
      '20300313',
      '20300314',
      '20300315',
      '20300316',
      '20300317',
    );
    expect(first.created).toEqual(expected);
    expect(second.created).toEqual([]);
    expect(await partitions()).toEqual(expected);
  });

  it('accepts the last millisecond of the last premade day and refuses the next midnight with 23514', async () => {
    // Act
    await insertAt('2030-03-17T23:59:59.999Z');
    const state = await sqlStateOf(insertAt('2030-03-18T00:00:00.000Z'));

    // Assert
    expect(state).toBe('23514');
  });

  it('never makes a DEFAULT partition', async () => {
    // Act
    const bounds: { bound: string }[] = await dataSource().query(
      `SELECT pg_get_expr(c.relpartbound, c.oid) AS bound FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
        WHERE i.inhparent = '${PROBE_TABLE}'::regclass`,
    );

    // Assert
    expect(bounds).toHaveLength(8);
    expect(bounds.filter((row) => row.bound.includes('DEFAULT'))).toEqual([]);
  });

  it('keeps a partition its guard holds, logs an error, and scrubs each eligible partition once', async () => {
    // Arrange
    const error = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    probe.keep = (partition) =>
      [name('20300314'), name('20300315')].includes(partition.name) ? 'rows still pending' : null;
    probe.scrubbed = [];

    // Act
    const report = await maintain('2030-03-30T00:00:00.000Z');

    // Assert
    expect(report.dropped).toEqual(days('20300310', '20300311', '20300312', '20300313', '20300316', '20300317'));
    expect(report.kept).toEqual([
      { partition: name('20300314'), reason: 'rows still pending' },
      { partition: name('20300315'), reason: 'rows still pending' },
    ]);
    expect(report.scrubbed).toEqual(days('20300314', '20300315'));
    expect(probe.scrubbed).toEqual(days('20300314', '20300315'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('rows still pending'), expect.any(String));
    expect(report.created).toEqual(
      days('20300330', '20300331', '20300401', '20300402', '20300403', '20300404', '20300405', '20300406'),
    );
    error.mockRestore();
  });

  it('drops the partitions before the retention cut once nothing holds them', async () => {
    // Arrange
    probe.keep = () => null;
    probe.scrubbed = [];

    // Act
    const report = await maintain('2030-03-30T00:00:00.000Z');

    // Assert
    expect(report.dropped).toEqual(days('20300314', '20300315'));
    expect(report.created).toEqual([]);
    expect((await partitions()).every((table) => table >= name('20300330'))).toBe(true);
  });

  it('lets two concurrent runs both succeed, creating each partition once', async () => {
    // Act
    const [a, b] = await Promise.all([maintain('2030-04-20T00:00:00.000Z'), maintain('2030-04-20T00:00:00.000Z')]);

    // Assert
    const created = [...a.created, ...b.created].sort();
    expect(created).toEqual(
      days('20300420', '20300421', '20300422', '20300423', '20300424', '20300425', '20300426', '20300427'),
    );
    expect(await partitions()).toEqual(created);
  });

  it('closes the registry at bootstrap', () => {
    // Act / Assert
    const register = () => {
      server.app
        .get(PartitionRegistry)
        .register({ table: 'late', column: 'c', interval: 'day', premake: 1, retain: 1 });
    };
    expect(register).toThrow(PartitionRegistryClosedError);
  });
});

describe('partitionMaintenanceTask', () => {
  it('maintains at the platform clock time and records the task heartbeat', async () => {
    // Arrange
    clockMs = Date.parse('2030-05-01T02:00:00.000Z');
    const injector = new Injector(server.app.get(ModuleRef));

    // Act
    const counts: unknown = await partitionMaintenanceTask.options.execute({
      injector,
      scheduledContext: undefined as never,
      params: {},
    });

    // Assert
    expect(counts).toEqual({ created: 8, dropped: 4, kept: 0, scrubbed: 4 });
    const heartbeats = await server.app.get(TaskHeartbeatReader).lastSuccess();
    expect(heartbeats.get('partition-maintenance')).toEqual(new Date(clockMs));
    expect(partitionMaintenanceTask.options.schedule).toBe('0 2 * * *');
    expect(partitionMaintenanceTask.options.timeout).toBe(300_000);
  });
});
