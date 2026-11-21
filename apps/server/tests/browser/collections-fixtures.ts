import type { Page } from 'playwright-core';
import { adminApi } from './store-switcher-fixtures';

/** A product of the active store with its tags and options, created through the catalog API as the page's user. */
export interface ProductSeed {
  readonly title: string;
  readonly tagIds?: readonly string[];
  readonly options?: readonly { readonly name: string; readonly values: readonly string[] }[];
}

export async function createProduct(page: Page, seed: ProductSeed): Promise<string> {
  const { createCatalogProduct } = await adminApi<{ createCatalogProduct: { product: { id: string } } }>(
    page,
    'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
    {
      input: {
        title: seed.title,
        status: 'active',
        price: 2500,
        tagIds: seed.tagIds ?? [],
        ...(seed.options === undefined ? {} : { optionGroups: seed.options }),
      },
    },
  );
  return createCatalogProduct.product.id;
}

export const deleteProduct = (page: Page, id: string) =>
  adminApi(page, 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id });

export async function createTag(page: Page, name: string): Promise<string> {
  const { createCatalogTag } = await adminApi<{ createCatalogTag: { id: string } }>(
    page,
    'mutation ($input: CatalogTagInput!) { createCatalogTag(input: $input) { id } }',
    { input: { name } },
  );
  return createCatalogTag.id;
}

export const deleteTag = (page: Page, id: string) =>
  adminApi(page, 'mutation ($id: String!) { deleteCatalogTag(id: $id) }', { id });

/** A manual collection of the active store, created through our API as the page's user. */
export async function createManualCollection(
  page: Page,
  title: string,
  change: { readonly visible?: boolean } = {},
): Promise<string> {
  const { createStoreCollection } = await adminApi<{ createStoreCollection: { id: string } }>(
    page,
    'mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id } }',
    { input: { title, visible: change.visible ?? true, position: 0, mode: 'manual' } },
  );
  return createStoreCollection.id;
}

export const setCollectionProducts = (page: Page, id: string, productIds: readonly string[]) =>
  adminApi(
    page,
    'mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id } }',
    { id, productIds },
  );

export const deleteCollection = (page: Page, id: string) =>
  adminApi(page, 'mutation ($id: ID!) { deleteStoreCollection(id: $id) }', { id });

/** The ids of the store's collections whose title holds `search`. */
export async function collectionIdsMatching(page: Page, search: string): Promise<readonly string[]> {
  const { storeCollections } = await adminApi<{ storeCollections: { items: readonly { id: string }[] } }>(
    page,
    'query ($options: StoreCollectionListInput) { storeCollections(options: $options) { items { id } } }',
    { options: { search, take: 10 } },
  );
  return storeCollections.items.map(({ id }) => id);
}

/** The manual collection ids of one product. */
export async function manualCollectionsOf(page: Page, productId: string): Promise<readonly string[]> {
  const { storeProductCollections } = await adminApi<{
    storeProductCollections: { manual: readonly { id: string }[] };
  }>(page, 'query ($productId: ID!) { storeProductCollections(productId: $productId) { manual { id } } }', {
    productId,
  });
  return storeProductCollections.manual.map(({ id }) => id);
}

/** The ids of a collection's products in their order. */
export async function collectionProductIds(page: Page, id: string): Promise<readonly string[]> {
  const { storeCollectionProducts } = await adminApi<{
    storeCollectionProducts: { items: readonly { productId: string }[] };
  }>(page, 'query ($id: ID!) { storeCollectionProducts(id: $id) { items { productId } } }', { id });
  return storeCollectionProducts.items.map(({ productId }) => productId);
}
