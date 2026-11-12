/**
 * Every P1 table that holds one business's data, with the SQL that counts a business's rows in it. The census proves
 * the world gave both businesses something to steal before the matrix reaches for it. `custom_domain` (a stub
 * until P8.S9, no endpoint writes it) and `business_order_sequence` (written by the first order, P4) stay empty in
 * P1 and are left out; `inbound_webhook_key` is keyed by provider account, not by business.
 */
const BY_BUSINESS = (table: string): string => `SELECT count(*)::int AS n FROM "${table}" WHERE "businessId" = $1`;

export const TENANT_TABLE_COUNTS = {
  business: 'SELECT count(*)::int AS n FROM "business" WHERE "id" = $1',
  administrator: 'SELECT count(*)::int AS n FROM "administrator" WHERE "customFieldsBusinessid" = $1',
  store: BY_BUSINESS('store'),
  business_role: BY_BUSINESS('business_role'),
  role_binding: BY_BUSINESS('role_binding'),
  member_role_assignment: BY_BUSINESS('member_role_assignment'),
  activity_log: BY_BUSINESS('activity_log'),
  tenant_secret: BY_BUSINESS('tenant_secret'),
  tenant_data_key: BY_BUSINESS('tenant_data_key'),
  feature_flag_override: `SELECT count(*)::int AS n FROM "feature_flag_override" WHERE "scope" = 'business' AND "scopeId" = $1`,
  inbound_webhook: BY_BUSINESS('inbound_webhook'),
  outbox_event: BY_BUSINESS('outbox_event'),
  outbox_delivery: BY_BUSINESS('outbox_delivery'),
  template_note: BY_BUSINESS('template_note'),
} as const;

export type TenantTable = keyof typeof TENANT_TABLE_COUNTS;

export const TENANT_TABLES = Object.keys(TENANT_TABLE_COUNTS) as TenantTable[];

/** Runs one SQL statement with parameters; the e2e test passes TypeORM's, the evidence runner a `pg` client's. */
export interface SqlRunner {
  query(sql: string, parameters: unknown[]): Promise<{ n: number }[]>;
}

/** A's and B's row counts in every tenant table. */
export async function tenantRowCounts(
  sql: SqlRunner | { rawConnection: SqlRunner },
  [a, b]: readonly [string, string],
): Promise<Record<TenantTable, { a: number; b: number }>> {
  const runner = 'rawConnection' in sql ? sql.rawConnection : sql;
  const count = async (statement: string, businessId: string): Promise<number> =>
    (await runner.query(statement, [businessId]))[0]?.n ?? 0;
  const entries = await Promise.all(
    TENANT_TABLES.map(async (table) => {
      const statement = TENANT_TABLE_COUNTS[table];
      return [table, { a: await count(statement, a), b: await count(statement, b) }] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<TenantTable, { a: number; b: number }>;
}
