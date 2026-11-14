import type { BusinessFixture, StoreFixture } from '@cod/testing';
import type { CatalogKit } from './catalog-kit';

/** A snowflake-sized id no generator hands out, for rows a test inserts by SQL. */
export const syntheticId = (): string => String(1_300_000_000_000_000_000n + BigInt(Math.floor(Math.random() * 1e9)));

/** A brand or tag row of `store` inserted directly, bypassing the API; returns its id. Test-only access. */
export async function insertNameRow(
  kit: CatalogKit,
  table: 'catalog_brand' | 'catalog_tag',
  business: BusinessFixture,
  store: StoreFixture,
): Promise<string> {
  const id = syntheticId();
  const name = `Name ${id}`;
  await kit.query(
    `INSERT INTO "${table}" ("businessId", "storeId", "id", "name", "nameKey", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [business.businessId, store.id, id, name, name.toLowerCase()],
  );
  return id;
}
