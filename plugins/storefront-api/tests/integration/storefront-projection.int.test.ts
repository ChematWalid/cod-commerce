import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { toBusinessId, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ProjectionBackfill } from '../../infrastructure/projection-backfill';
import { idsOf, storefrontSuite } from './storefront-kit';

const suite = storefrontSuite(941, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

interface ProjectionRowShape {
  readonly name: string;
  readonly price: number;
  readonly listed: boolean;
  readonly soldOut: boolean;
}

const rowOf = async (productId: string): Promise<ProjectionRowShape | undefined> => {
  const rows = await suite.kit.query<ProjectionRowShape>(
    'SELECT name, price, listed, "soldOut" FROM storefront_product WHERE "productId" = $1',
    [productId],
  );
  return rows[0];
};

describe('the storefront projection', () => {
  it('follows a product edit through the outbox', async () => {
    // Arrange
    const { kit, fixtures } = suite;
    const storeA = fixtures.a.stores[0].id;
    await kit.asOwner(fixtures.a);
    const product = await kit.product('Jellaba bleue', { price: 3000 });
    await kit.storeUntil('/store/products', storeA, (answer) => idsOf(answer).includes(product.id));

    // Act
    await kit.updateProduct(product.id, { title: 'Jellaba verte', price: 3500 });
    const answer = await kit.storeUntil('/store/products', storeA, (page) =>
      JSON.stringify(page.body).includes('Jellaba verte'),
    );

    // Assert
    expect(answer.status).toBe(200);
    expect(await rowOf(product.id)).toMatchObject({ name: 'Jellaba verte', price: 3500 });
  });

  it('keeps a sold-out product listed in a keeping store and drops it after the store switches to hide', async () => {
    // Arrange
    const { kit, fixtures } = suite;
    const store = fixtures.a.stores[1];
    await kit.asOwner(fixtures.a, store);
    await kit.updateStore(store, { soldOutBehavior: 'keep' });
    const product = await kit.product('Tricot sold out');
    await kit.updateProduct(product.id, { settings: { soldOut: true } });
    await kit.storeUntil('/store/products', store.id, (answer) => idsOf(answer).includes(product.id));

    // Act
    await kit.updateStore(store, { soldOutBehavior: 'hide' });
    const hidden = await kit.storeUntil('/store/products', store.id, (answer) => !idsOf(answer).includes(product.id));
    await kit.updateStore(store, { soldOutBehavior: 'keep' });
    const shown = await kit.storeUntil('/store/products', store.id, (answer) => idsOf(answer).includes(product.id));

    // Assert
    expect(hidden.status).toBe(200);
    expect(shown.status).toBe(200);
    expect(await rowOf(product.id)).toMatchObject({ soldOut: true, listed: true });
  });

  it("rebuilds an empty store's projection and leaves the other business's rows alone", async () => {
    // Arrange
    const { kit, fixtures } = suite;
    await kit.asOwner(fixtures.b);
    const product = await kit.product('Chlaka backfilled');
    await kit.storeUntil('/store/products', fixtures.b.stores[0].id, (answer) => idsOf(answer).includes(product.id));
    await kit.query('DELETE FROM storefront_product WHERE "storeId" = $1', [fixtures.b.stores[0].id]);
    const before = await kit.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM storefront_product WHERE "businessId" = $1',
      [fixtures.a.businessId],
    );

    // Act
    const counts = await kit.app.get(ProjectionBackfill).run();

    // Assert
    expect(counts.stores).toBeGreaterThanOrEqual(1);
    expect(await rowOf(product.id)).toMatchObject({ name: 'Chlaka backfilled', listed: true });
    const after = await kit.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM storefront_product WHERE "businessId" = $1',
      [fixtures.a.businessId],
    );
    expect(after).toEqual(before);
  });

  it("drops a ghost row on a store rebuild, keeps the live products, and leaves the other business's rows alone", async () => {
    // Arrange: a row of a product the catalog no longer has, as a missed `deleted` delivery would leave.
    const { kit, fixtures } = suite;
    const store = fixtures.a.stores[0];
    await kit.asOwner(fixtures.a, store);
    const product = await kit.product('Burnous rebuilt');
    await kit.storeUntil('/store/products', store.id, (answer) => idsOf(answer).includes(product.id));
    const ghostProductId = String(Number(product.id) + 1_000_000);
    await kit.query(
      `INSERT INTO storefront_product (id, "businessId", "storeId", "productId", slug, name, "searchText", price,
         "oldPrice", "imagePath", visible, "soldOut", listed, "createdAt", "updatedAt")
       SELECT id + 1000000, "businessId", "storeId", $2, slug || '-ghost', 'Ghost product', "searchText", price,
         "oldPrice", "imagePath", visible, "soldOut", listed, "createdAt", "updatedAt"
       FROM storefront_product WHERE "productId" = $1 AND "storeId" = $3`,
      [product.id, ghostProductId, store.id],
    );
    const countOfB = () =>
      kit.query<{ n: number }>('SELECT count(*)::int AS n FROM storefront_product WHERE "businessId" = $1', [
        fixtures.b.businessId,
      ]);
    const before = await countOfB();
    expect(await rowOf(ghostProductId)).toMatchObject({ name: 'Ghost product' });

    // Act
    const scope = { businessId: toBusinessId(fixtures.a.businessId), storeId: toStoreId(store.id) };
    const read = await kit.app.get(ProjectionBackfill).rebuild(scope);

    // Assert
    expect(typeof read).toBe('number');
    expect(await rowOf(ghostProductId)).toBeUndefined();
    expect(await rowOf(product.id)).toMatchObject({ name: 'Burnous rebuilt', listed: true });
    expect(await countOfB()).toEqual(before);
  });
});
