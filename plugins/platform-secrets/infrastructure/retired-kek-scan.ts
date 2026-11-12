import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { RetiredKekScanPort } from '../domain/ports/kek-rotation.ports';

/**
 * The platform's scan for data keys left on a retired KEK (D114). It crosses businesses on purpose and so is one of
 * the files allowed raw data access: it selects `businessId` and a count, never a key or a secret, and the rewrap it
 * leads to runs under that business's scope.
 */
@Injectable()
export class PostgresRetiredKekScan implements RetiredKekScanPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async staleBusinesses(activeKid: string, after: string | null, limit: number): Promise<readonly string[]> {
    const rows = await this.connection.rawConnection.query<{ businessId: string }[]>(
      `SELECT "businessId"::text AS "businessId" FROM "tenant_data_key"
        WHERE "kid" <> $1 AND "businessId" > $2::bigint
        ORDER BY "businessId" LIMIT $3`,
      [activeKid, after ?? '0', limit],
    );
    return rows.map((row) => row.businessId);
  }

  async countStale(activeKid: string): Promise<number> {
    const rows = await this.connection.rawConnection.query<{ stale: number }[]>(
      `SELECT count(*)::int AS "stale" FROM "tenant_data_key" WHERE "kid" <> $1`,
      [activeKid],
    );
    return rows[0]?.stale ?? 0;
  }
}
