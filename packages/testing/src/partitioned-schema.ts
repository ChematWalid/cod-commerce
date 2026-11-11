import type { PartitionedTableSchema } from '@cod/shared';

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
