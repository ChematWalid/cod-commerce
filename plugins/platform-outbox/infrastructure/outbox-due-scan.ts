import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { DueDeliveryRow, OutboxDueScanPort, PendingEventRow, PendingSummary } from '../application/ports';

interface EventRowShape {
  id: string;
  createdAt: Date;
  businessId: string;
}

interface DeliveryRowShape {
  createdAt: Date;
  outboxId: string;
  consumer: string;
  businessId: string;
  attempts: number;
  stuckSince: Date;
  nextAttemptAt: Date | null;
}

/** Lowest id and time a keyset cursor starts from. */
const BEFORE_EVERYTHING = '0';

/**
 * The platform's scan of due outbox rows (D125). It crosses businesses on purpose and so is one of the files allowed
 * raw data access: it selects ids, `businessId`, statuses and times, never a payload, and every fix-up it leads to
 * goes through a `TenantRepository` under that row's business.
 */
@Injectable()
export class PostgresOutboxDueScan implements OutboxDueScanPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async sweepBatch(
    range: { readonly from: Date; readonly to: Date },
    after: PendingEventRow | null,
    limit: number,
    work: (rows: readonly PendingEventRow[]) => Promise<void>,
  ): Promise<readonly PendingEventRow[]> {
    const cursorTime = after?.createdAt ?? new Date(range.from.getTime() - 1);
    return this.connection.rawConnection.transaction(async (manager) => {
      const rows = await manager.query<EventRowShape[]>(
        `SELECT "id"::text AS "id", "createdAt", "businessId"::text AS "businessId"
           FROM "outbox_event"
          WHERE "status" = 'pending' AND "createdAt" >= $1 AND "createdAt" < $2
            AND ("createdAt", "id") > ($3, $4::bigint)
          ORDER BY "createdAt", "id"
          LIMIT $5
          FOR UPDATE SKIP LOCKED`,
        [range.from, range.to, cursorTime, after?.id ?? BEFORE_EVERYTHING, limit],
      );
      await work(rows);
      return rows;
    });
  }

  async dueDeliveries(since: Date, touchedBefore: Date, limit: number): Promise<readonly DueDeliveryRow[]> {
    return this.connection.rawConnection.query<DeliveryRowShape[]>(
      `SELECT "createdAt", "outboxId"::text AS "outboxId", "consumer", "businessId"::text AS "businessId",
              "attempts", "nextAttemptAt", COALESCE("enqueuedAt", "updatedAt") AS "stuckSince"
         FROM "outbox_delivery"
        WHERE "status" IN ('pending', 'enqueued') AND "createdAt" >= $1
          AND COALESCE("enqueuedAt", "updatedAt") <= $2
        ORDER BY COALESCE("enqueuedAt", "updatedAt"), "createdAt", "outboxId"
        LIMIT $3`,
      [since, touchedBefore, limit],
    );
  }

  async pendingSummary(): Promise<PendingSummary> {
    const rows = await this.connection.rawConnection.query<{ pending: number; oldest: Date | null }[]>(
      `SELECT count(*)::int AS "pending", min("createdAt") AS "oldest" FROM "outbox_event" WHERE "status" = 'pending'`,
    );
    return { pending: rows[0]?.pending ?? 0, oldest: rows[0]?.oldest ?? null };
  }
}
