import { isSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type {
  DueJobQuery,
  DueJobRow,
  JobRef,
  JobRowScope,
  JobScanPort,
} from '../application/ports/job-repository.port';
import type { JobTable } from '../domain/job-kinds';

const TABLE_OF: Record<JobTable, string> = { import: 'catalog_import_job', export: 'catalog_export_job' };
/** Lowest cursor: before every row. */
const BEFORE_EVERYTHING = { updatedAt: new Date(0), table: '', id: '0' };

interface ScopeRowShape {
  businessId: string;
  storeId: string;
  status: string;
  actorAdministratorId: number | null;
}

const dueSelect = (table: JobTable): string =>
  `SELECT '${table}'::text AS "table", "id", "businessId"::text AS "businessId", "storeId"::text AS "storeId",
          "status", "updatedAt"
     FROM "${TABLE_OF[table]}"
    WHERE ("status" = ANY($1) AND "updatedAt" <= $2) OR ("status" = 'running' AND "updatedAt" <= $3)`;

/**
 * The platform's reads of job rows across businesses (D2212). It crosses businesses on purpose, like the outbox's due
 * scan, and so is one of the files allowed raw data access: it selects ids, scope, status, actor and times only,
 * never a payload, and every write that follows goes through `TypeOrmJobRepository` under the row's own scope.
 */
@Injectable()
export class PostgresJobScan implements JobScanPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async rowScopeOf(ref: JobRef): Promise<JobRowScope | undefined> {
    if (!isSnowflake(ref.id)) return undefined;
    const rows = await this.connection.rawConnection.query<ScopeRowShape[]>(
      `SELECT "businessId"::text AS "businessId", "storeId"::text AS "storeId", "status", "actorAdministratorId"
         FROM "${TABLE_OF[ref.table]}" WHERE "id" = $1::bigint`,
      [ref.id],
    );
    return rows[0];
  }

  async dueJobs(query: DueJobQuery): Promise<readonly DueJobRow[]> {
    const cursor = query.after ?? BEFORE_EVERYTHING;
    const rows = await this.connection.rawConnection.query<(DueJobRow & { id: string })[]>(
      `SELECT "table", "id"::text AS "id", "businessId", "storeId", "status", "updatedAt"
         FROM (${dueSelect('import')} UNION ALL ${dueSelect('export')}) AS due
        WHERE ("updatedAt", "table", "id") > ($4, $5, $6::bigint)
        ORDER BY "updatedAt", "table", "id"
        LIMIT $7`,
      [
        [...query.requeueStatuses],
        query.requeueBefore,
        query.failBefore,
        cursor.updatedAt,
        cursor.table,
        cursor.id,
        query.limit,
      ],
    );
    return rows;
  }
}
