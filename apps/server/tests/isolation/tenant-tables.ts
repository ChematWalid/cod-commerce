/**
 * Every P1 table that holds one business's data, with the SQL that counts a business's rows in it. The census proves
 * the world gave both businesses something to steal before the matrix reaches for it. `custom_domain` (a stub
 * until P8.S9, no endpoint writes it) and `business_order_sequence` (written by the first order, P4) stay empty in
 * P1 and are left out; `inbound_webhook_key` is keyed by provider account, not by business. `salary_payment` stays empty:
 * only an active member other than the payer can be paid, and the only way to one is the invitation mail's token.
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
  team_member: BY_BUSINESS('team_member'),
  invitation: BY_BUSINESS('invitation'),
  commission_config: BY_BUSINESS('commission_config'),
} as const;

/**
 * The catalog tables (P2.S1, D2100): the P2 world seeds a row of each business in every one. Vendure's own product,
 * variant and asset tables carry no business column; their rows are reached through the catalog cases instead.
 */
export const CATALOG_TABLE_COUNTS = {
  catalog_brand: BY_BUSINESS('catalog_brand'),
  catalog_tag: BY_BUSINESS('catalog_tag'),
  catalog_product_tag: BY_BUSINESS('catalog_product_tag'),
  catalog_highlight: BY_BUSINESS('catalog_highlight'),
  catalog_product_highlight: BY_BUSINESS('catalog_product_highlight'),
  catalog_product_settings: BY_BUSINESS('catalog_product_settings'),
  catalog_product_collection: BY_BUSINESS('catalog_product_collection'),
  catalog_media: BY_BUSINESS('catalog_media'),
} as const;

/** The offers tables (P2.S4, D2405): the P2 world seeds an offer with a target and a code in each business. */
export const OFFERS_TABLE_COUNTS = {
  offers_offer: BY_BUSINESS('offers_offer'),
  offers_offer_target: BY_BUSINESS('offers_offer_target'),
  offers_code: BY_BUSINESS('offers_code'),
} as const;

/**
 * The collections tables (P2.S3, D2300): the P2 world seeds collections with rules and members in each business
 * through `createStoreCollection` (D2330).
 */
export const COLLECTIONS_TABLE_COUNTS = {
  collections_definition: BY_BUSINESS('collections_definition'),
  collections_member: BY_BUSINESS('collections_member'),
} as const;

/** The pack tables (P2.S2, D2202): the P2 world saves a pack with two components in each business. */
export const CATALOG_PACKS_TABLE_COUNTS = {
  catalog_pack: BY_BUSINESS('catalog_pack'),
  catalog_pack_component: BY_BUSINESS('catalog_pack_component'),
} as const;

/**
 * The import and export tables (P2.S2, D2210, D2211, D2214): the P2 world previews a spreadsheet import (its job and
 * rows), exports a product and imports a link (its job and the Draft's origin) in each business.
 */
export const CATALOG_IMPORT_TABLE_COUNTS = {
  catalog_import_job: BY_BUSINESS('catalog_import_job'),
  catalog_import_row: BY_BUSINESS('catalog_import_row'),
  catalog_export_job: BY_BUSINESS('catalog_export_job'),
  catalog_product_origin: BY_BUSINESS('catalog_product_origin'),
} as const;

/**
 * The delivery-pricing tables (P3.S1, D3125): the P3 world creates two groups with their wilaya rows and a commune
 * override on each business's first store. The geo tables are global reference data (D3103), outside the census.
 */
export const DELIVERY_PRICING_TABLE_COUNTS = {
  delivery_fee_group: BY_BUSINESS('delivery_fee_group'),
  delivery_fee_rate: BY_BUSINESS('delivery_fee_rate'),
  delivery_fee_commune_rate: BY_BUSINESS('delivery_fee_commune_rate'),
} as const;

/** The tables the P2 world fills: P1's, the catalog's, the offers', the collections', the packs' and the import's. */
const P2_TABLE_COUNTS = {
  ...TENANT_TABLE_COUNTS,
  ...CATALOG_TABLE_COUNTS,
  ...OFFERS_TABLE_COUNTS,
  ...COLLECTIONS_TABLE_COUNTS,
  // P2.S2: the packs' and the import's.
  ...CATALOG_PACKS_TABLE_COUNTS,
  ...CATALOG_IMPORT_TABLE_COUNTS,
};

/** Every counted table: the P2 world's and the delivery pricing's (P3.S1). */
const ALL_TABLE_COUNTS = { ...P2_TABLE_COUNTS, ...DELIVERY_PRICING_TABLE_COUNTS };

export type TenantTable = keyof typeof ALL_TABLE_COUNTS;

/**
 * Catalog tables no server path writes any more: with the collections plugin registered, a product's manual
 * collection links live in `collections_member` (D2309); the table is dropped after P2. The census expects them empty.
 */
export const RETIRED_TABLES: readonly TenantTable[] = ['catalog_product_collection'];

/** The P1 tenant tables: the P1 world fills each. */
export const TENANT_TABLES = Object.keys(TENANT_TABLE_COUNTS) as TenantTable[];

/**
 * The P1 tables, the catalog's, the offers', the collections', the packs' and the import's, less the retired ones: the
 * P2 world fills each.
 */
export const P2_TENANT_TABLES = (Object.keys(P2_TABLE_COUNTS) as TenantTable[]).filter(
  (table) => !RETIRED_TABLES.includes(table),
);

/** The delivery-pricing tables: the P3 world fills each. */
export const P3_TENANT_TABLES = Object.keys(DELIVERY_PRICING_TABLE_COUNTS) as TenantTable[];

/** Runs one SQL statement with parameters; the e2e test passes TypeORM's, the evidence runner a `pg` client's. */
export interface SqlRunner {
  query(sql: string, parameters: unknown[]): Promise<{ n: number }[]>;
}

/** A's and B's row counts in every table of `tables` (the P1 tenant tables unless named). */
export async function tenantRowCounts(
  sql: SqlRunner | { rawConnection: SqlRunner },
  [a, b]: readonly [string, string],
  tables: readonly TenantTable[] = TENANT_TABLES,
): Promise<Partial<Record<TenantTable, { a: number; b: number }>>> {
  const runner = 'rawConnection' in sql ? sql.rawConnection : sql;
  const count = async (statement: string, businessId: string): Promise<number> =>
    (await runner.query(statement, [businessId]))[0]?.n ?? 0;
  const entries = await Promise.all(
    tables.map(async (table) => {
      const statement = ALL_TABLE_COUNTS[table];
      return [table, { a: await count(statement, a), b: await count(statement, b) }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
