import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { storefrontCollectionPageSchema } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { idsOf, type MadeProduct, storefrontSuite } from './storefront-kit';
import { STOREFRONT_ROUTES } from './storefront-registry';

const suite = storefrontSuite(942, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

/** What each business holds: a product of its first store and a visible collection holding it. */
interface Holdings {
  readonly product: MadeProduct;
  readonly collectionSlug: string;
  readonly collectionId: string;
}

const held = {} as { a: Holdings; b: Holdings; aHidden: MadeProduct };

beforeAll(async () => {
  const { kit, fixtures } = suite;
  await kit.asOwner(fixtures.b);
  const bProduct = await kit.product('Sabbat B');
  held.b = { product: bProduct, collectionSlug: 'b-only', collectionId: await kit.collection('b-only', [bProduct.id]) };
  await kit.asOwner(fixtures.a);
  const aProduct = await kit.product('Sabbat A', { price: 200 });
  held.aHidden = await kit.product('Sabbat A hidden', { status: 'hidden' });
  const aCollection = await kit.collection('a-robes', [aProduct.id, held.aHidden.id]);
  held.a = { product: aProduct, collectionSlug: 'a-robes', collectionId: aCollection };
  await kit.storeUntil('/store/products', fixtures.a.stores[0].id, (answer) => idsOf(answer).includes(aProduct.id));
  await kit.storeUntil('/store/products', fixtures.b.stores[0].id, (answer) => idsOf(answer).includes(bProduct.id));
});

describe('the storefront API between two businesses', () => {
  it.each(STOREFRONT_ROUTES.map((route) => [route.path, route] as const))(
    "%s signed for A never answers B's product or collection",
    async (_path, route) => {
      // Arrange
      const fill = { productSlug: held.b.product.slug, collectionSlug: held.b.collectionSlug };

      // Act
      const answer = await suite.kit.store(route.sample(fill), suite.fixtures.a.stores[0].id);

      // Assert
      expect([200, 404]).toContain(answer.status);
      expect(answer.text).not.toContain(held.b.product.slug);
      expect(answer.text).not.toContain('Sabbat B');
      expect(answer.text).not.toContain(held.b.collectionSlug);
    },
  );

  it.each(STOREFRONT_ROUTES.map((route) => [route.path, route] as const))(
    "%s signed for A's other store never answers A's first store's data",
    async (_path, route) => {
      // Arrange
      const fill = { productSlug: held.a.product.slug, collectionSlug: held.a.collectionSlug };

      // Act
      const answer = await suite.kit.store(route.sample(fill), suite.fixtures.a.stores[1].id);

      // Assert
      expect([200, 404]).toContain(answer.status);
      expect(answer.text).not.toContain('Sabbat A');
    },
  );

  it("filters A's list by A's collection to its listed members, and answers 404 for B's collection slug", async () => {
    // Arrange
    const storeA = suite.fixtures.a.stores[0].id;

    // Act
    const own = await suite.kit.store(`/store/products?collection=${held.a.collectionSlug}`, storeA);
    const foreign = await suite.kit.store(`/store/products?collection=${held.b.collectionSlug}`, storeA);
    const repeated = await suite.kit.store('/store/products?collection=a&collection=b', storeA);

    // Assert
    expect(idsOf(own)).toEqual([held.a.product.id]);
    expect(foreign).toMatchObject({ status: 404, text: '' });
    expect(repeated).toMatchObject({ status: 404, text: '' });
  });

  it("answers A's collection page with its first page of listed products, in the shared shape", async () => {
    // Act
    const answer = await suite.kit.store(`/store/collection/${held.a.collectionSlug}`, suite.fixtures.a.stores[0].id);

    // Assert
    expect(answer.status).toBe(200);
    expect(storefrontCollectionPageSchema.safeParse(answer.body).success).toBe(true);
    expect(answer.body).toMatchObject({
      collection: { id: held.a.collectionId, slug: held.a.collectionSlug },
      products: { totalItems: 1, items: [{ id: held.a.product.id }] },
    });
  });

  it('lists only the signed store collections', async () => {
    // Act
    const answer = await suite.kit.store('/store/collections', suite.fixtures.a.stores[0].id);

    // Assert
    const slugs = (answer.body as { items: { slug: string }[] }).items.map((item) => item.slug);
    expect(slugs).toContain(held.a.collectionSlug);
    expect(slugs).not.toContain(held.b.collectionSlug);
  });

  it("keeps every projection row in its own business and store (B's rows never carry A's store)", async () => {
    // Act
    const crossed = await suite.kit.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM storefront_product p JOIN store s ON s.id = p."storeId"
        WHERE s."businessId" <> p."businessId"`,
    );

    // Assert
    expect(crossed).toEqual([{ n: 0 }]);
  });
});
