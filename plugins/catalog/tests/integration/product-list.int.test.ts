import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, CATALOG_MAX_PAGE_SIZE } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogSuite, insertNameRow, type ProductResult, PRODUCTS, UPDATE_PRODUCT } from './catalog-kit';

const suite = catalogSuite(1023, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

interface ListAnswer {
  readonly catalogProducts: { totalItems: number; items: { id: string; title: string; status: string }[] };
}

describe('product list and search (AC4, D2123)', () => {
  let byName: ProductResult;
  let bySku: ProductResult;
  let byVariantSku: ProductResult;
  let byBarcode: ProductResult;
  let draft: ProductResult;
  let collectionId: string;
  let brandId: string;
  let tagId: string;
  let combined: ProductResult;

  const list = async (options: Record<string, unknown>) =>
    (await suite.kit.gql<ListAnswer>(PRODUCTS, { options })).catalogProducts;
  const titles = async (options: Record<string, unknown>) =>
    (await list(options)).items.map((item) => item.title).sort();

  beforeAll(async () => {
    const { a } = suite.fixtures;
    collectionId = await suite.kit.createCollection(a.stores[0]);
    brandId = await insertNameRow(suite.kit, 'catalog_brand', a, a.stores[0]);
    tagId = await insertNameRow(suite.kit, 'catalog_tag', a, a.stores[0]);
    await suite.kit.asOwner(a);
    byName = await suite.kit.createProduct({ title: 'Zebra sandal' });
    bySku = await suite.kit.createProduct({ title: 'Plain one', sku: 'QX-ZEBRA-7' });
    byVariantSku = await suite.kit.createProduct({
      title: 'Plain two',
      sku: 'VV',
      optionGroups: [{ name: 'Size', values: ['S'] }],
    });
    await suite.kit.gql(UPDATE_PRODUCT, {
      id: byVariantSku.id,
      input: { variants: [{ id: byVariantSku.variants[0]?.id, sku: 'ZEBRAVAR' }] },
    });
    byBarcode = await suite.kit.createProduct({
      title: 'Plain three',
      optionGroups: [{ name: 'Size', values: ['S'] }],
    });
    await suite.kit.gql(UPDATE_PRODUCT, {
      id: byBarcode.id,
      input: { variants: [{ id: byBarcode.variants[0]?.id, barcode: '9990ZEBRA' }] },
    });
    draft = await suite.kit.createProduct({ title: 'Zebra draft', status: 'draft' });
    combined = await suite.kit.createProduct({
      title: 'Combined',
      brandId,
      tagIds: [tagId],
      collectionIds: [collectionId],
    });
    await suite.kit.createProduct({ title: 'Brand only', brandId });
  });

  it('finds products by name, product sku, variant sku and barcode', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const found = await titles({ q: 'zebra' });

    // Assert
    expect(found).toEqual([byName, bySku, byVariantSku, byBarcode, draft].map((product) => product.title).sort());
  });

  it('no longer finds a product by the sku of a variant removed from its options', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const shoe = await suite.kit.createProduct({
      title: 'Removal check',
      sku: 'QRM',
      optionGroups: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    });
    await suite.kit.gql(UPDATE_PRODUCT, {
      id: shoe.id,
      input: { optionGroups: [{ name: 'Size', values: ['S', 'M'] }] },
    });

    // Act
    const removed = await titles({ q: 'QRM-3' });
    const kept = await titles({ q: 'QRM-1' });

    // Assert
    expect(removed).toEqual([]);
    expect(kept).toEqual(['Removal check']);
  });

  it('lists only drafts on the draft tab, with or without a search term', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act / Assert
    expect(await titles({ tab: 'draft' })).toEqual(['Zebra draft']);
    expect(await titles({ tab: 'draft', q: 'zebra' })).toEqual(['Zebra draft']);
  });

  it('combines the brand, tag and collection filters', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const found = await titles({ brandId, tagId, collectionId });

    // Assert
    expect(found).toEqual([combined.title]);
  });

  it("answers an empty list for B's collection and for the other store's brand or tag", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    const collectionOfB = await suite.kit.createCollection(b.stores[0]);
    const otherBrand = await insertNameRow(suite.kit, 'catalog_brand', a, a.stores[1]);
    const otherTag = await insertNameRow(suite.kit, 'catalog_tag', a, a.stores[1]);
    await suite.kit.asOwner(a);

    // Act
    const totals = await Promise.all([
      list({ collectionId: collectionOfB }),
      list({ brandId: otherBrand }),
      list({ tagId: otherTag }),
    ]);

    // Assert
    expect(totals.map((page) => page.totalItems)).toEqual([0, 0, 0]);
  });

  it('caps a page at the maximum size', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const failure = await failureOf(list({ take: CATALOG_MAX_PAGE_SIZE + 1 }));
    const rest = await suite.kit.rest('GET', `/catalog/products?take=${String(CATALOG_MAX_PAGE_SIZE + 1)}`);

    // Assert
    expect(failure.codes).toEqual([CATALOG_ERROR_CODES.INVALID_INPUT]);
    expect(rest.status).toBe(400);
  });
});
