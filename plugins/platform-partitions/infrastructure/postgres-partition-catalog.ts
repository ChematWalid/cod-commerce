import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { PARTITION_LOCK_KEY_PREFIX, PARTITION_LOCK_TIMEOUT } from '../domain/constants';
import type { PartitionCatalog, PartitionTableSession } from '../domain/partition-catalog.port';
import type { PartitionRef } from '../domain/policy';

/** What a statement of one table's transaction can run: TypeORM's `EntityManager`, seen through its `query`. */
interface Queryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

const RANGE_BOUND = /FROM \('([^']+)'\) TO \('([^']+)'\)/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const BARE_OFFSET = /([+-]\d{2})$/;

const quote = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

/** A bound as `pg_get_expr` prints it in a UTC session (`2030-03-10 00:00:00+00`) as an instant. */
function parseBound(text: string): Date {
  if (DATE_ONLY.test(text)) return new Date(`${text}T00:00:00Z`);
  return new Date(text.replace(' ', 'T').replace(BARE_OFFSET, '$1:00'));
}

/** One table's work inside its transaction. The names it quotes come from validated policies and from the calendar. */
class PostgresTableSession implements PartitionTableSession {
  constructor(
    private readonly queryable: Queryable,
    private readonly table: string,
  ) {}

  async list(): Promise<PartitionRef[]> {
    const rows = (await this.queryable.query(
      `SELECT c.relname AS name, pg_get_expr(c.relpartbound, c.oid) AS bound
         FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
        WHERE i.inhparent = to_regclass($1)`,
      [quote(this.table)],
    )) as { name: string; bound: string }[];
    return rows
      .flatMap((row) => {
        const match = RANGE_BOUND.exec(row.bound);
        if (match?.[1] === undefined || match[2] === undefined) return [];
        return [{ table: this.table, name: row.name, start: parseBound(match[1]), end: parseBound(match[2]) }];
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  async create(partition: PartitionRef): Promise<void> {
    await this.queryable.query(
      `CREATE TABLE IF NOT EXISTS ${quote(partition.name)} PARTITION OF ${quote(this.table)}
         FOR VALUES FROM ('${partition.start.toISOString()}') TO ('${partition.end.toISOString()}')`,
    );
  }

  async drop(partition: PartitionRef): Promise<void> {
    await this.queryable.query(`ALTER TABLE ${quote(this.table)} DETACH PARTITION ${quote(partition.name)}`);
    await this.queryable.query(`DROP TABLE ${quote(partition.name)}`);
  }

  async execute(sql: string): Promise<void> {
    await this.queryable.query(sql);
  }
}

/**
 * {@link PartitionCatalog} on PostgreSQL: DDL and catalog reads only, no tenant row (listed in `RAW_DATA_ACCESS_FILES`).
 * Each table's work is one transaction with a local lock timeout and a transaction-scoped advisory lock, both safe
 * through the pooler (D106).
 */
@Injectable()
export class PostgresPartitionCatalog implements PartitionCatalog {
  constructor(private readonly connection: TransactionalConnection) {}

  inTableTransaction<T>(table: string, work: (session: PartitionTableSession) => Promise<T>): Promise<T> {
    return this.connection.rawConnection.transaction(async (manager) => {
      await manager.query(`SET LOCAL lock_timeout = '${PARTITION_LOCK_TIMEOUT}'`);
      // Bounds are printed in the session's zone; UTC makes them parse as the instants they are.
      await manager.query(`SET LOCAL timezone = 'UTC'`);
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `${PARTITION_LOCK_KEY_PREFIX}${table}`,
      ]);
      return work(new PostgresTableSession(manager, table));
    });
  }
}
