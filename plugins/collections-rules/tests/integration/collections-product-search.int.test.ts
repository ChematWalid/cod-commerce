import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { codeOf, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { CollectionsMembers } from './collections-members';
import { createProduct } from './collections-products';
import { PRODUCT_SEARCH, type ProductPageResult } from './collections-rules-api';

const suite = collectionsSuite(1019, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const search = async (options: Readonly<Record<string, unknown>>): Promise<ProductPageResult> =>
  (await suite.kit.gql<{ storeCollectionProductSearch: ProductPageResult }>(PRODUCT_SEARCH, { options }))
    .storeCollectionProductSearch;

describe('the product search of the manual collection editor (D2321)', () => {
  let shoes: string[];

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.b);
    await createProduct(suite.kit, 'Running shoe of B');
    await suite.kit.asOwner(suite.fixtures.a, suite.fixtures.a.stores[1]);
    await createProduct(suite.kit, 'Running shoe of A2');
    await suite.kit.asOwner(suite.fixtures.a);
    const first = await createProduct(suite.kit, 'Running shoe');
    await createProduct(suite.kit, 'Summer hat');
    const second = await createProduct(suite.kit, 'Trail SHOE');
    shoes = [second, first];
  });

  it('finds by title in the active store only, newest first, over GraphQL and REST', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const found = await search({ search: 'shoe' });
    const rest = await suite.kit.rest('GET', '/catalog/collections/product-search?search=shoe&take=1&skip=1');

    // Assert
    expect(found).toEqual({
      totalItems: 2,
      items: [
        { productId: shoes[0], title: 'Trail SHOE' },
        { productId: shoes[1], title: 'Running shoe' },
      ],
    });
    expect(rest.status).toBe(200);
    expect(rest.body).toMatchObject({ totalItems: 2, items: [{ productId: rawId(shoes[1] ?? '') }] });
    expect(rest.text).not.toMatch(/of B|of A2/);
  });

  it('lists every product of the store without a search', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const all = await search({});

    // Assert
    expect(all.totalItems).toBe(3);
  });

  it('is open to a collections member who can edit, and refused to one who can only view', async () => {
    // Arrange
    const members = new CollectionsMembers(suite.kit);
    await members.signInAsMember(suite.fixtures.a, ['catalog.collections.edit']);
    const editor = await search({ search: 'hat' });
    await members.signInAsMember(suite.fixtures.a, ['catalog.collections.view']);

    // Act
    const viewer = await codeOf(search({ search: 'hat' }));

    // Assert
    expect(editor.items.map((item) => item.title)).toEqual(['Summer hat']);
    expect(viewer).toBe('FORBIDDEN');
  });

  it('refuses an over-long page with invalid-input', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const code = await codeOf(search({ take: 1_000 }));

    // Assert
    expect(code).toBe(COLLECTIONS_ERROR_CODES.INVALID_INPUT);
  });
});
