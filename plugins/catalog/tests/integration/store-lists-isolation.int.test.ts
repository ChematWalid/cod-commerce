import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_MAX_PAGE_SIZE } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogSuite, PRODUCTS, type ProductResult, SLUG, UPDATE_PRODUCT } from './catalog-kit';

const suite = catalogSuite(1023, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const TITLE = 'Lantern of the first store';
const SKU = 'FIRST-STORE-LANTERN-1';
const SOLD_OUT =
  'query ($options: CatalogSoldOutListInput) { catalogSoldOutProducts(options: $options) { items { productId } } }';

interface ListAnswer {
  readonly catalogProducts: { readonly items: readonly { readonly id: string }[] };
}
interface RestRow {
  readonly title: string;
}

/** The product ids `options` lists for the signed-in caller's active store. */
const listedIds = async (options: Record<string, unknown>): Promise<string[]> =>
  (
    await suite.kit.gql<ListAnswer>(PRODUCTS, { options: { take: CATALOG_MAX_PAGE_SIZE, ...options } })
  ).catalogProducts.items.map((item) => item.id);

const soldOutIds = async (): Promise<string[]> =>
  (
    await suite.kit.gql<{ catalogSoldOutProducts: { items: { productId: string }[] } }>(SOLD_OUT, {
      options: { take: CATALOG_MAX_PAGE_SIZE },
    })
  ).catalogSoldOutProducts.items.map((row) => row.productId);

const slugFree = async (slug: string): Promise<boolean> =>
  (await suite.kit.gql<{ catalogSlugAvailability: { available: boolean } }>(SLUG, { slug })).catalogSlugAvailability
    .available;

/** The titles of a REST list answer: a page (`items`); its rows carry the title. */
function restTitles(body: unknown): string[] {
  return (body as { items: RestRow[] }).items.map((row) => row.title);
}

/**
 * Store isolation inside one business for the store-level reads: an owner reaches both of A's stores, so only the
 * active store's channel keeps the first store's product out of the second store's lists, search, sold-out views and
 * slug check. The by-id cells are in `isolation-sweep.int.test.ts`.
 */
describe("A's second store never lists or reserves its first store's product", () => {
  let inFirst: ProductResult;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    inFirst = await suite.kit.createProduct({ title: TITLE, sku: SKU });
    await suite.kit.gql(UPDATE_PRODUCT, { id: inFirst.id, input: { settings: { soldOut: true } } });
  });

  it('the first store itself lists, finds and reserves it (positive control)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const seen = [
      await listedIds({ q: TITLE }),
      await listedIds({ q: SKU }),
      await listedIds({ tab: 'sold-out' }),
      await soldOutIds(),
    ];
    const free = await slugFree(inFirst.slug);

    // Assert
    for (const ids of seen) expect(ids).toContain(inFirst.id);
    expect(free).toBe(false);
  });

  it.each([
    ['the plain list', {}],
    ['a search by its title', { q: TITLE }],
    ['a search by its sku', { q: SKU }],
    ['the sold-out tab', { tab: 'sold-out' }],
  ])('%s of the second store leaves it out', async (_case, options) => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const ids = await listedIds(options);

    // Assert
    expect(ids).not.toContain(inFirst.id);
  });

  it('catalogSoldOutProducts of the second store leaves it out, and its slug is free there', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const soldOut = await soldOutIds();
    const free = await slugFree(inFirst.slug);

    // Assert
    expect(soldOut).not.toContain(inFirst.id);
    expect(free).toBe(true);
  });

  it.each([
    `/catalog/products?q=${encodeURIComponent(TITLE)}`,
    `/catalog/products?q=${SKU}`,
    '/catalog/products?tab=sold-out',
    '/catalog/sold-out-products',
  ])('GET %s from the second store leaves it out', async (path) => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const answer = await suite.kit.rest('GET', path);

    // Assert
    expect(answer.status).toBe(200);
    expect(restTitles(answer.body)).not.toContain(TITLE);
  });

  it('GET /catalog/products/slug-availability from the second store reports its slug free', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const answer = await suite.kit.rest(
      'GET',
      `/catalog/products/slug-availability?slug=${encodeURIComponent(inFirst.slug)}`,
    );

    // Assert
    expect(answer.status).toBe(200);
    expect(answer.body).toMatchObject({ available: true });
  });
});
