import { PartitionMaintenanceFailedError } from '../domain/errors';
import type { PartitionCatalog, PartitionLogger, PartitionTableSession } from '../domain/partition-catalog.port';
import { expiredPartitions, plannedPartitions, scrubbableByAge } from '../domain/partition-calendar';
import type { PartitionMaintenanceReport, PartitionPolicy, PartitionRef } from '../domain/policy';
import type { PartitionRegistry } from './partition-registry';

type TableReport = { -readonly [K in keyof PartitionMaintenanceReport]: PartitionMaintenanceReport[K] };

const emptyReport = (): TableReport => ({ created: [], dropped: [], kept: [], scrubbed: [] });

/** The partitions of `planned` that no existing partition starts at (a partition is told apart by its lower bound). */
function missing(planned: readonly PartitionRef[], existing: readonly PartitionRef[]): PartitionRef[] {
  const starts = new Set(existing.map((partition) => partition.start.getTime()));
  return planned.filter((partition) => !starts.has(partition.start.getTime()));
}

/**
 * What may be logged of a failure: its class name and, for a database error, the SQLSTATE; never its message, which
 * could hold a statement or a value.
 */
function describeFailure(error: unknown): string {
  if (!(error instanceof Error)) return typeof error;
  const { code } = error as { code?: unknown };
  return typeof code === 'string' ? `${error.name} (${code})` : error.name;
}

/** Makes the planned partitions of tables and drops, keeps and scrubs the old ones, as the registered policies say. */
export class PartitionMaintenanceService {
  constructor(
    private readonly registry: PartitionRegistry,
    private readonly catalog: PartitionCatalog,
    private readonly logger: PartitionLogger,
  ) {}

  /**
   * Maintains every registered table as of `now`. Safe to run late and twice. A table that fails does not stop the
   * others; the failures are thrown together at the end.
   * @throws PartitionMaintenanceFailedError when any table failed.
   */
  async maintain(now: Date): Promise<PartitionMaintenanceReport> {
    const total = emptyReport();
    const failures: { table: string; reason: string }[] = [];
    for (const policy of this.registry.policies()) {
      try {
        // Creation commits on its own, so a failing guard or scrub below never costs the table its premade days.
        await this.catalog.inTableTransaction(policy.table, async (session) => {
          const listed = await session.list();
          const created: string[] = [];
          for (const partition of missing(plannedPartitions(policy, now), listed)) {
            await session.create(partition, policy.column);
            created.push(partition.name);
          }
          total.created.push(...created);
        });
        const done = await this.catalog.inTableTransaction(policy.table, (session) =>
          this.retireTable(policy, session, now),
        );
        total.dropped.push(...done.dropped);
        total.kept.push(...done.kept);
        total.scrubbed.push(...done.scrubbed);
      } catch (error) {
        const reason = describeFailure(error);
        this.logger.error(`Partition maintenance of ${policy.table} failed: ${reason}`);
        failures.push({ table: policy.table, reason });
      }
    }
    if (failures.length > 0) throw new PartitionMaintenanceFailedError(failures);
    return total;
  }

  /** Drops, keeps and scrubs the old partitions in one transaction, listing them again under the table's lock. */
  private async retireTable(policy: PartitionPolicy, session: PartitionTableSession, now: Date): Promise<TableReport> {
    const report = emptyReport();
    const existing = await session.list();
    const dropped = await this.dropExpired(policy, session, expiredPartitions(policy, existing, now), report);
    const remaining = existing.filter((partition) => !dropped.has(partition.name));
    const { scrub } = policy;
    if (scrub === undefined) return report;
    for (const partition of scrubbableByAge(policy, remaining, now)) {
      await session.execute(scrub.sql(partition.name));
      report.scrubbed.push(partition.name);
    }
    return report;
  }

  /** Drops what retention expired unless the policy's guard holds it; returns the names dropped. */
  private async dropExpired(
    policy: PartitionPolicy,
    session: PartitionTableSession,
    expired: readonly PartitionRef[],
    report: TableReport,
  ): Promise<ReadonlySet<string>> {
    const dropped = new Set<string>();
    for (const partition of expired) {
      const reason = (await policy.keepIf?.(partition)) ?? null;
      if (reason !== null) {
        this.logger.error(`Partition ${partition.name} is past retention but kept: ${reason}`);
        report.kept.push({ partition: partition.name, reason });
        continue;
      }
      await session.drop(partition);
      dropped.add(partition.name);
      report.dropped.push(partition.name);
    }
    return dropped;
  }
}
