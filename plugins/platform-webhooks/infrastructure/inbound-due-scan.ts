import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { DueInboundRow, InboundDueScanPort, KeyPurgePort } from '../application/ports';

interface DueRowShape {
  id: string;
  receivedAt: Date;
  businessId: string;
  attempts: number;
  stuckSince: Date;
}

/** Lowest id a keyset cursor starts from. */
const BEFORE_EVERYTHING = '0';

/**
 * The platform's scans of the gateway across businesses (D105, D107). It is allowed raw data access: the due scan
 * selects ids, `businessId`, attempts and times, never a payload (every fix-up goes through a `TenantRepository` under
 * that row's business), and the purge deletes rows of the platform table `inbound_webhook_key`.
 */
@Injectable()
export class PostgresInboundScan implements InboundDueScanPort, KeyPurgePort {
  constructor(private readonly connection: TransactionalConnection) {}

  dueWebhooks(
    since: Date,
    touchedBefore: Date,
    limit: number,
    after?: DueInboundRow,
  ): Promise<readonly DueInboundRow[]> {
    const cursor = after ?? { stuckSince: new Date(0), receivedAt: new Date(0), id: BEFORE_EVERYTHING };
    return this.connection.rawConnection.query<DueRowShape[]>(
      `SELECT "id"::text AS "id", "receivedAt", "businessId"::text AS "businessId", "attempts", "updatedAt" AS "stuckSince"
         FROM "inbound_webhook"
        WHERE "status" = 'received' AND "receivedAt" >= $1 AND "updatedAt" <= $2
          AND ("updatedAt", "receivedAt", "id") > ($4, $5, $6::bigint)
        ORDER BY "updatedAt", "receivedAt", "id"
        LIMIT $3`,
      [since, touchedBefore, limit, cursor.stuckSince, cursor.receivedAt, cursor.id],
    );
  }

  async deleteKeysBefore(cutoff: Date, limit: number): Promise<number> {
    const rows = await this.connection.rawConnection.query<{ n: number }[]>(
      `WITH gone AS (
         DELETE FROM "inbound_webhook_key"
          WHERE ctid IN (SELECT ctid FROM "inbound_webhook_key" WHERE "receivedAt" < $1 LIMIT $2)
          RETURNING 1)
       SELECT count(*)::int AS "n" FROM gone`,
      [cutoff, limit],
    );
    return rows[0]?.n ?? 0;
  }
}
