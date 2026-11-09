import type { OperationContext } from '../../domain/ports/operation-context';
import type { TenantScope } from '@cod/shared';
import type { ActivityEntry, ActivityQuery, ActivityRecord } from '../../domain/activity';
import type { ActivityLogPort } from '../../domain/ports/activity-log.port';

/** Rows in memory, with the same visibility rules as the Postgres adapter. */
export class InMemoryActivityLog implements ActivityLogPort {
  readonly entries: ActivityEntry[] = [];

  append(_ctx: OperationContext, entry: ActivityEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }

  list(_ctx: OperationContext, scope: TenantScope, query: ActivityQuery): Promise<readonly ActivityRecord[]> {
    const rows = this.entries
      .filter((entry) => entry.scope.businessId === scope.businessId)
      .filter((entry) => entry.storeId === undefined || query.visibleStoreIds.includes(entry.storeId))
      .filter((entry) => query.before === undefined || BigInt(entry.id) < BigInt(query.before))
      .filter((entry) => query.action === undefined || entry.action === query.action)
      .filter((entry) => query.entityType === undefined || entry.entityType === query.entityType)
      .filter((entry) => query.entityId === undefined || entry.entityId === query.entityId)
      .filter(
        (entry) =>
          query.actorAdministratorId === undefined || entry.actorAdministratorId === query.actorAdministratorId,
      )
      .sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1))
      .slice(0, query.limit);
    return Promise.resolve(rows.map((entry) => ({ ...entry, storeId: entry.storeId ?? null })));
  }
}
