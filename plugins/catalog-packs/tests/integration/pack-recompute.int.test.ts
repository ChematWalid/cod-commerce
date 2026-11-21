import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { rawTestId } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  outboxSettled as settled,
  PACK,
  type PackResult,
  packInput,
  packsSuite,
  type ProductResult,
  SAVE_PACK,
  until,
  UPDATE_PRODUCT,
} from './packs-kit';

const suite = packsSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

interface PackWorld {
  shirt: ProductResult;
  trousers: ProductResult;
  pack: ProductResult;
}

/** As `business`'s owner: components 1 500 and 2 000 and a saved 10 % pack of them (3 150). */
async function packWorld(business = suite.fixtures.a): Promise<PackWorld> {
  await suite.kit.asOwner(business);
  const shirt = await suite.kit.createProduct({ title: 'Shirt', price: 1500 });
  const trousers = await suite.kit.createProduct({ title: 'Trousers', price: 2000 });
  const pack = await suite.kit.createPackProduct();
  await suite.kit.gql(SAVE_PACK, { id: pack.id, input: packInput([shirt.id, trousers.id]) });
  return { shirt, trousers, pack };
}

interface PackRow {
  id: string;
  businessId: string;
  storeId: string;
  status: string;
  updatedAt: string;
}

/** The stored `catalog_pack` row of pack product `productId`, read under catalog-packs. */
async function packRowOf(productId: string): Promise<PackRow> {
  const [row] = await suite.kit.query<PackRow>(
    `SELECT "id"::text AS id, "businessId"::text AS "businessId", "storeId"::text AS "storeId", status,
            "updatedAt"::text AS "updatedAt"
       FROM catalog_pack WHERE "productId" = $1`,
    [Number(rawTestId(productId))],
  );
  if (row === undefined) throw new Error('the pack row is missing');
  return row;
}

/** Waits until every event is relayed and every delivery has run, so no earlier recompute is still pending. */
async function outboxSettled(): Promise<void> {
  await settled(suite.kit);
}

async function packOf(productId: string): Promise<PackResult | null> {
  const { catalogPack } = await suite.kit.gql<{ catalogPack: PackResult | null }>(PACK, { id: productId });
  return catalogPack;
}

describe('pack recompute on product.changed (D2203)', () => {
  let world: PackWorld;

  beforeEach(async () => {
    world = await packWorld();
  });

  it("editing a component price updates the pack variant's stored price after the outbox drains", async () => {
    // Act
    await suite.kit.gql(UPDATE_PRODUCT, { id: world.shirt.id, input: { price: 2500 } });

    // Assert: (2 500 + 2 000) × 0.9
    const price = await until(async () => {
      const product = await suite.kit.product(world.pack.id);
      return product?.variants[0]?.price === 4050 ? product.variants[0].price : undefined;
    });
    expect(price).toBe(4050);
  });

  it('setting a component to draft marks the pack stale and keeps the last price', async () => {
    // Act
    await suite.kit.gql('mutation ($id: ID!) { setCatalogProductStatus(id: $id, status: draft) { id } }', {
      id: world.trousers.id,
    });

    // Assert
    const pack = await until(async () => {
      const read = await packOf(world.pack.id);
      return read?.status === 'stale' ? read : undefined;
    });
    expect(pack.price).toBe(3150);
  });

  it('patching the pack product to physical drops its pack rows', async () => {
    // Arrange: no API turns a pack physical (D2227), so the type is changed under catalog, then a plain edit
    // publishes the product.changed the consumer reads.
    await suite.kit.query('UPDATE product SET "customFieldsType" = $1 WHERE id = $2', [
      'physical',
      world.pack.id.replace(/^T_/, ''),
    ]);

    // Act
    await suite.kit.gql(UPDATE_PRODUCT, { id: world.pack.id, input: { label: 'Now physical' } });

    // Assert
    const rows = await until(async () => {
      const [row] = await suite.kit.query<{ count: string }>(
        'SELECT count(*)::text AS count FROM catalog_pack WHERE "productId" = $1',
        [Number(world.pack.id.replace(/^T_/, ''))],
      );
      return row?.count === '0' ? row.count : undefined;
    });
    expect(rows).toBe('0');
  });

  it("a change in business A never recomputes B's packs, even one whose row names A's product", async () => {
    // Arrange: a B component row naming A's shirt, planted under catalog-packs (no API stores one). A consumer that
    // read packs by product id alone would find B's pack, fail to read A's shirt in B's store and mark it stale.
    const other = await packWorld(suite.fixtures.b);
    await outboxSettled();
    const packOfB = await packRowOf(other.pack.id);
    await suite.kit.query(
      `INSERT INTO catalog_pack_component ("id", "businessId", "storeId", "packId", "position", "productId", "variantId", "quantity")
       SELECT max("id") + 1, $1, $2, $3, 99, $4, NULL, 1 FROM catalog_pack_component`,
      [packOfB.businessId, packOfB.storeId, packOfB.id, Number(rawTestId(world.shirt.id))],
    );
    await suite.kit.asOwner(suite.fixtures.a);

    // Act: A's change drains
    await suite.kit.gql(UPDATE_PRODUCT, { id: world.shirt.id, input: { price: 2500 } });
    await until(async () => ((await suite.kit.product(world.pack.id))?.price === 4050 ? true : undefined));

    // Assert: B's pack row was neither repriced nor marked
    expect(await packRowOf(other.pack.id)).toEqual(packOfB);
    await suite.kit.asOwner(suite.fixtures.b);
    expect((await suite.kit.product(other.pack.id))?.price).toBe(3150);
  });
});

/** How many lock requests of `locktype` (`relation` on table `table`) wait in this database. */
async function waitingLocks(locktype: 'advisory' | 'relation', table?: string): Promise<number> {
  const [row] = await suite.kit.query<{ waiting: number }>(
    `SELECT count(*)::int AS waiting FROM pg_locks
      WHERE NOT granted AND locktype = $1 AND ($2::text IS NULL OR relation = to_regclass($2))
        AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`,
    [locktype, table ?? null],
  );
  return row?.waiting ?? 0;
}

describe('concurrent pack writes (D2241)', () => {
  it('two concurrent first saves of one pack both succeed and leave one pack row', async () => {
    // Arrange: a fresh pack product, so neither save finds a row
    const { shirt, trousers } = await packWorld();
    const fresh = await suite.kit.createPackProduct();
    const input = packInput([shirt.id, trousers.id]);

    // Act
    const saved = await Promise.all(
      [1, 2].map(() => suite.kit.gql<{ saveCatalogPack: PackResult }>(SAVE_PACK, { id: fresh.id, input })),
    );

    // Assert
    expect(saved.map(({ saveCatalogPack }) => saveCatalogPack.price)).toEqual([3150, 3150]);
    const [row] = await suite.kit.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM catalog_pack WHERE "productId" = $1',
      [Number(rawTestId(fresh.id))],
    );
    expect(row?.count).toBe('1');
  });
});

describe('a component written during a pack save (D2242)', () => {
  it("an edit of a component during a pack's first save is reflected in the stored price once the outbox drains", async () => {
    // Arrange: fresh components no other pack holds, and a fresh pack product
    await suite.kit.asOwner(suite.fixtures.a);
    const belt = await suite.kit.createProduct({ title: 'Belt', price: 1500 });
    const cap = await suite.kit.createProduct({ title: 'Cap', price: 2000 });
    const pack = await suite.kit.createPackProduct();
    await outboxSettled();
    // Hold the save after it read its components: a transaction that lets reads through but blocks the pack rows' insert
    const runner = suite.kit.app.get(TransactionalConnection).rawConnection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.query('LOCK TABLE catalog_pack, catalog_pack_component IN SHARE MODE');
    const edit = { done: false };
    try {
      const saving = suite.kit.gql(SAVE_PACK, { id: pack.id, input: packInput([belt.id, cap.id]) });
      await until(async () => ((await waitingLocks('relation', 'catalog_pack')) > 0 ? true : undefined));

      // Act: the edit either commits at once (its recompute then runs while the save is open) or waits for the save
      const editing = suite.kit.gql(UPDATE_PRODUCT, { id: belt.id, input: { price: 2500 } }).then(() => {
        edit.done = true;
      });
      await until(async () => (edit.done || (await waitingLocks('advisory')) > 0 ? true : undefined));
      if (edit.done) await outboxSettled();
      await runner.commitTransaction();
      await Promise.all([saving, editing]);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
    await outboxSettled();

    // Assert: (2 500 + 2 000) x 0.9 on the pack product and its pack, still ok
    expect((await suite.kit.product(pack.id))?.price).toBe(4050);
    expect(await packOf(pack.id)).toMatchObject({ price: 4050, status: 'ok' });
  });
});
