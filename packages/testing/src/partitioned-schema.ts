import type { PartitionedTableSchema } from '@cod/shared';
import { TransactionalConnection } from '@vendure/core';

/** A Nest provider class, the token `app.get` takes. */
type Type<T> = abstract new (...args: never[]) => T;

/** The one member of a TypeORM `DataSource` that {@link ensurePartitionedSchema} uses: it runs raw SQL. */
export interface SqlRunner {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

/**
 * Creates the partitioned tables of a plugin test (D106), which `synchronize: true` cannot do: it would make plain
 * tables. A table that already exists is left alone, so a test file may call this before every suite.
 * Partitions come from the maintenance service, never from here.
 */
export async function ensurePartitionedSchema(
  dataSource: SqlRunner,
  schemas: readonly PartitionedTableSchema[],
): Promise<void> {
  for (const schema of schemas) {
    const rows = (await dataSource.query('SELECT to_regclass($1) AS found', [schema.table])) as {
      found: string | null;
    }[];
    if (rows[0]?.found !== null && rows[0]?.found !== undefined) continue;
    await dataSource.query(schema.createSql);
  }
}

/** What the platform's partition maintenance offers: it creates the partitions the current time needs. */
export interface PartitionMaintainer {
  maintain(now: Date): Promise<unknown>;
}

/** The part of a plugin test server {@link withPartitionedSchemas} extends: `init` and the booted Nest app. */
export interface InitializableServer {
  init: (...args: never[]) => Promise<void>;
  readonly app: { get<T>(token: Type<T>): T };
}

/**
 * Makes `server.init` also create the partitioned tables of `schemas` and their current partitions, once Vendure has
 * built the rest of the schema (D106, D127). The one place every suite that grants business roles (which write the
 * partitioned `activity_log`) or uses the outbox gets them from. `maintenance` is `PartitionMaintenanceService`.
 */
export function withPartitionedSchemas(
  server: InitializableServer,
  schemas: readonly PartitionedTableSchema[],
  maintenance: Type<PartitionMaintainer>,
): void {
  const init = server.init.bind(server);
  server.init = async (...args: never[]): Promise<void> => {
    await init(...args);
    await ensurePartitionedSchema(server.app.get(TransactionalConnection).rawConnection, schemas);
    await server.app.get(maintenance).maintain(new Date());
  };
}
