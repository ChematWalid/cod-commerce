import { describe, expect, it } from 'vitest';
import { PartitionMaintenanceService } from '../../application/partition-maintenance.service';
import { PartitionRegistry } from '../../application/partition-registry';
import { PartitionMaintenanceFailedError } from '../../domain/errors';
import type { PartitionCatalog, PartitionTableSession } from '../../domain/partition-catalog.port';
import type { PartitionPolicy, PartitionRef } from '../../domain/policy';

const DAY = 86_400_000;
const NOW = new Date('2030-03-30T00:00:00.000Z');

const ref = (table: string, start: Date): PartitionRef => ({
  table,
  name: `${table}_p${start.toISOString().slice(0, 10).replaceAll('-', '')}`,
  start,
  end: new Date(start.getTime() + DAY),
});

/** An in-memory catalog whose transactions roll back to the state they began with when the work throws. */
class FakeCatalog implements PartitionCatalog {
  committed: PartitionRef[];

  constructor(initial: PartitionRef[]) {
    this.committed = initial;
  }

  async inTableTransaction<T>(_table: string, work: (session: PartitionTableSession) => Promise<T>): Promise<T> {
    let working = [...this.committed];
    const session: PartitionTableSession = {
      list: () => Promise.resolve([...working]),
      create: (partition) => {
        working = [...working, partition];
        return Promise.resolve();
      },
      drop: (partition) => {
        working = working.filter((entry) => entry.name !== partition.name);
        return Promise.resolve();
      },
      execute: () => Promise.resolve(),
    };
    const result = await work(session);
    this.committed = working;
    return result;
  }
}

const quietLogger = { error: () => undefined };

describe('PartitionMaintenanceService', () => {
  it('commits the premade partitions even when a guard throws afterwards', async () => {
    // Arrange: a partition far past retention, so the guard runs
    const old = ref('probe', new Date(NOW.getTime() - 30 * DAY));
    const catalog = new FakeCatalog([old]);
    const policy: PartitionPolicy = {
      table: 'probe',
      column: 'createdAt',
      interval: 'day',
      premake: 7,
      retain: 7,
      keepIf: () => Promise.reject(new Error('guard broke')),
    };
    const registry = new PartitionRegistry();
    registry.register(policy);
    const service = new PartitionMaintenanceService(registry, catalog, quietLogger);

    // Act
    const run = service.maintain(NOW);

    // Assert
    await expect(run).rejects.toThrow(PartitionMaintenanceFailedError);
    expect(catalog.committed.filter((partition) => partition.start >= NOW)).toHaveLength(8);
    expect(catalog.committed).toContain(old);
  });

  it('commits the premade partitions even when a scrub throws afterwards', async () => {
    // Arrange
    const recent = ref('probe', new Date(NOW.getTime() - 3 * DAY));
    const catalog = new FakeCatalog([recent]);
    const registry = new PartitionRegistry();
    registry.register({
      table: 'probe',
      column: 'createdAt',
      interval: 'day',
      premake: 7,
      retain: 7,
      scrub: {
        afterIntervals: 1,
        sql: () => {
          throw new Error('scrub broke');
        },
      },
    });
    const service = new PartitionMaintenanceService(registry, catalog, quietLogger);

    // Act
    const run = service.maintain(NOW);

    // Assert
    await expect(run).rejects.toThrow(PartitionMaintenanceFailedError);
    expect(catalog.committed.filter((partition) => partition.start >= NOW)).toHaveLength(8);
  });
});
