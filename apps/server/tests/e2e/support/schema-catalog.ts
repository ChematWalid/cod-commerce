import type { Client } from 'pg';

/** One column as `pg_catalog` reports it. */
export interface CatalogColumn {
  readonly name: string;
  readonly type: string;
  readonly notNull: boolean;
  readonly default: string | null;
}

/** The columns of one table of `schema`, in declaration order. */
export async function catalogColumns(client: Client, schema: string, table: string): Promise<CatalogColumn[]> {
  const { rows } = await client.query<CatalogColumn>(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS "notNull",
            pg_get_expr(d.adbin, d.adrelid) AS "default"
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum`,
    [schema, table],
  );
  return rows;
}

/**
 * Everything the schema of the `public` schema is made of, as one comparable value: tables with their partition
 * key and bound, columns with types and defaults, indexes, constraints, triggers and functions. Generated names
 * (a partition's, an index's) are part of it on purpose: a second migrate must produce the same ones.
 */
export async function catalogSnapshot(client: Client): Promise<Record<string, unknown[]>> {
  const run = async (sql: string): Promise<unknown[]> => (await client.query<Record<string, unknown>>(sql)).rows;
  return {
    tables: await run(
      `SELECT c.relname AS name, c.relkind AS kind, pg_get_partkeydef(c.oid) AS "partitionKey",
              pg_get_expr(c.relpartbound, c.oid) AS bound, p.relname AS parent
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_inherits i ON i.inhrelid = c.oid
         LEFT JOIN pg_class p ON p.oid = i.inhparent
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        ORDER BY c.relname`,
    ),
    columns: await run(
      `SELECT c.relname AS "table", a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
              a.attnotnull AS "notNull", pg_get_expr(d.adbin, d.adrelid) AS "default",
              row_number() OVER (PARTITION BY c.relname ORDER BY a.attnum) AS position
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY c.relname, a.attnum`,
    ),
    indexes: await run(
      `SELECT tablename AS "table", indexname AS name, indexdef AS definition
         FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`,
    ),
    constraints: await run(
      `SELECT c.relname AS "table", k.conname AS name, k.contype AS kind, pg_get_constraintdef(k.oid) AS definition
         FROM pg_constraint k
         JOIN pg_class c ON c.oid = k.conrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' ORDER BY c.relname, k.conname`,
    ),
    triggers: await run(
      `SELECT c.relname AS "table", t.tgname AS name, pg_get_triggerdef(t.oid) AS definition
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY c.relname, t.tgname`,
    ),
    functions: await run(
      `SELECT p.proname AS name, pg_get_functiondef(p.oid) AS definition
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' ORDER BY p.proname`,
    ),
  };
}

/** A partition the migrate role premakes: `{table}_pYYYYMMDD` for a day, `{table}_pYYYYMM` for a month. */
const DATED_PARTITION = /_p\d{6}(\d{2})?$/;

/**
 * The snapshot without the day-named partitions (their rows, indexes and constraints), plus how many partitions
 * each parent has. Which days exist depends on the UTC date the migrate ran on, so two runs straddling midnight
 * differ in names and bounds but not in count.
 */
export function withoutDatedPartitions(snapshot: Record<string, unknown[]>): Record<string, unknown[]> {
  const isDated = (row: unknown): boolean => {
    const { name, table } = row as { name?: unknown; table?: unknown };
    return [name, table].some((value) => typeof value === 'string' && DATED_PARTITION.test(value));
  };
  const result: Record<string, unknown[]> = {};
  for (const [key, rows] of Object.entries(snapshot)) {
    result[key] = rows.filter((row) => !isDated(row));
  }
  const counts = new Map<string, number>();
  for (const row of snapshot['tables'] ?? []) {
    const { name, parent } = row as { name?: unknown; parent?: unknown };
    if (typeof name === 'string' && DATED_PARTITION.test(name) && typeof parent === 'string') {
      counts.set(parent, (counts.get(parent) ?? 0) + 1);
    }
  }
  result['partitionCounts'] = [...counts].map(([parent, count]) => ({ parent, count }));
  return result;
}
