import type { CollectionsKit } from './collections-kit';

/** The catalog's product create and update, the way the product editor saves (D2309). */
const CREATE_PRODUCT = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { id } }
}`;
export const UPDATE_PRODUCT = `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { id collectionIds } }
}`;

export const COLLECTION_PRODUCTS = `query ($id: ID!, $options: StoreCollectionProductListInput) {
  storeCollectionProducts(id: $id, options: $options) { totalItems items { productId title status price } }
}`;
export const SET_COLLECTION_PRODUCTS = `mutation ($id: ID!, $productIds: [ID!]!) {
  setStoreCollectionProducts(id: $id, productIds: $productIds) { id productCount }
}`;
export const PRODUCT_COLLECTIONS = `query ($productId: ID!) {
  storeProductCollections(productId: $productId) { manual { id title } automatic { id title } }
}`;
export const SET_PRODUCT_COLLECTIONS = `mutation ($productId: ID!, $collectionIds: [ID!]!) {
  setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) {
    manual { id title } automatic { id title }
  }
}`;
export const SLUG_AVAILABILITY = `query ($slug: String!, $collectionId: ID) {
  storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available }
}`;

/** A collection named on the product side. */
export interface CollectionRefResult {
  readonly id: string;
  readonly title: string;
}

/** The collections of one product. */
export interface ProductCollectionsResult {
  readonly manual: readonly CollectionRefResult[];
  readonly automatic: readonly CollectionRefResult[];
}

/** Creates an active product in the client's active store and returns its GraphQL id. */
export async function createProduct(kit: CollectionsKit, title: string): Promise<string> {
  const { createCatalogProduct } = await kit.gql<{ createCatalogProduct: { product: { id: string } } }>(
    CREATE_PRODUCT,
    { input: { title, status: 'active', price: 100 } },
  );
  return createCatalogProduct.product.id;
}

/** The product ids of a collection, in collection order. */
export async function productIdsOf(kit: CollectionsKit, collectionId: string): Promise<string[]> {
  const { storeCollectionProducts } = await kit.gql<{
    storeCollectionProducts: { items: { productId: string }[] };
  }>(COLLECTION_PRODUCTS, { id: collectionId, options: { take: 500 } });
  return storeCollectionProducts.items.map((item) => item.productId);
}

/** The collections of a product as the editor block reads them. */
export async function collectionsOfProduct(kit: CollectionsKit, productId: string): Promise<ProductCollectionsResult> {
  const { storeProductCollections } = await kit.gql<{ storeProductCollections: ProductCollectionsResult }>(
    PRODUCT_COLLECTIONS,
    { productId },
  );
  return storeProductCollections;
}

/**
 * Turns a collection automatic past the API (rule saves land in Task 7) with `productIds` (engine ids) as its matched
 * members, the way a recompute would leave it.
 */
export async function makeAutomatic(
  kit: CollectionsKit,
  collectionId: string,
  productIds: readonly string[] = [],
): Promise<void> {
  const rule = { version: 1, match: 'all', conditions: [{ field: 'on_sale', operator: 'is', value: true }] };
  await kit.query(
    `UPDATE collections_definition SET mode = 'automatic', match = 'all', rule = $2::jsonb WHERE "collectionId" = $1`,
    [collectionId, JSON.stringify(rule)],
  );
  // A raw UPDATE answers [rows, count], so the row is read back on its own.
  const [definition] = await kit.query<{ businessId: string; storeId: string }>(
    'SELECT "businessId", "storeId" FROM collections_definition WHERE "collectionId" = $1',
    [collectionId],
  );
  if (definition === undefined) throw new Error('no such definition');
  for (const productId of productIds) {
    await kit.query(
      `INSERT INTO collections_member ("businessId", "storeId", "id", "collectionId", "productId", "position")
       VALUES ($1, $2, (SELECT coalesce(max(id), 1500000000000000000) + 1 FROM collections_member), $3, $4, 0)`,
      [definition.businessId, definition.storeId, collectionId, productId],
    );
  }
}
