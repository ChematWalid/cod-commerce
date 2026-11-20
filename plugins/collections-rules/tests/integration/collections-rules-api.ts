import type { CollectionsKit } from './collections-kit';

/** The catalog's taxonomy and product writes the rule tests arrange a store with (all through the API). */
const CREATE_BRAND = 'mutation ($input: CatalogBrandInput!) { createCatalogBrand(input: $input) { id } }';
const CREATE_TAG = 'mutation ($input: CatalogTagInput!) { createCatalogTag(input: $input) { id } }';
const CREATE_PRODUCT = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { id variants { id optionValues } } }
}`;
const UPDATE_PRODUCT = `mutation ($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { id } }
}`;

/** The rule builder's operations. */
export const PREVIEW = `query ($input: StoreCollectionPreviewInput!) {
  previewStoreCollectionMatches(input: $input) { totalItems items { productId title status price } }
}`;
export const RULE_OPTIONS = `query {
  storeCollectionRuleOptions { brands { id name } tags { id name } options { name values } }
}`;
export const PRODUCT_SEARCH = `query ($options: StoreCollectionProductSearchInput) {
  storeCollectionProductSearch(options: $options) { totalItems items { productId title } }
}`;

/** A page of matches or search results as the tests read it. */
export interface ProductPageResult {
  readonly totalItems: number;
  readonly items: readonly { readonly productId: string; readonly title: string }[];
}

/** The builder's options as the tests read them. */
export interface RuleOptionsResult {
  readonly brands: readonly { readonly id: string; readonly name: string }[];
  readonly tags: readonly { readonly id: string; readonly name: string }[];
  readonly options: readonly { readonly name: string; readonly values: readonly string[] }[];
}

/** One condition as GraphQL and REST take it. */
export type ConditionInput = Readonly<Record<string, unknown>>;

/** A version-1 rule over `conditions`. */
export const ruleOf = (match: 'all' | 'any', ...conditions: ConditionInput[]) => ({ version: 1, match, conditions });
export const tagIs = (operator: string, ...values: string[]): ConditionInput => ({ field: 'tag', operator, values });
export const brandIs = (operator: string, ...values: string[]): ConditionInput => ({
  field: 'brand',
  operator,
  values,
});
export const priceBetween = (min: number | null, max: number | null): ConditionInput => ({
  field: 'price',
  operator: 'between',
  min,
  max,
});
export const optionIs = (option: string, operator: string, ...values: string[]): ConditionInput => ({
  field: 'option',
  option,
  operator,
  values,
});

export async function createBrand(kit: CollectionsKit, name: string): Promise<string> {
  const { createCatalogBrand } = await kit.gql<{ createCatalogBrand: { id: string } }>(CREATE_BRAND, {
    input: { name },
  });
  return createCatalogBrand.id;
}

export async function createTag(kit: CollectionsKit, name: string): Promise<string> {
  const { createCatalogTag } = await kit.gql<{ createCatalogTag: { id: string } }>(CREATE_TAG, { input: { name } });
  return createCatalogTag.id;
}

/** A product made through the catalog API, with its variants (one per option value when it has an option group). */
export interface ProductResult {
  readonly id: string;
  readonly variants: readonly { readonly id: string; readonly optionValues: readonly string[] }[];
}

/** Creates an active product in the client's active store; any catalog field may be given. */
export async function createRuleProduct(
  kit: CollectionsKit,
  input: Readonly<Record<string, unknown>>,
): Promise<ProductResult> {
  const { createCatalogProduct } = await kit.gql<{ createCatalogProduct: { product: ProductResult } }>(CREATE_PRODUCT, {
    input: { status: 'active', price: 100, ...input },
  });
  return createCatalogProduct.product;
}

/** Hides the product's variants that carry `optionValue` (D2304: a hidden variant's options never match). */
export async function hideVariantsWith(
  kit: CollectionsKit,
  product: ProductResult,
  optionValue: string,
): Promise<void> {
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    isHidden: variant.optionValues.includes(optionValue),
  }));
  await kit.gql(UPDATE_PRODUCT, { id: product.id, input: { variants } });
}

/** Changes catalog fields of a product (a tag, its price) through the product editor's save. */
export async function updateRuleProduct(
  kit: CollectionsKit,
  productId: string,
  input: Readonly<Record<string, unknown>>,
): Promise<void> {
  await kit.gql(UPDATE_PRODUCT, { id: productId, input });
}

/** The preview of `rule` in the client's active store. */
export async function previewOf(
  kit: CollectionsKit,
  rule: unknown,
  page: { readonly skip?: number; readonly take?: number } = {},
): Promise<ProductPageResult> {
  const { previewStoreCollectionMatches } = await kit.gql<{ previewStoreCollectionMatches: ProductPageResult }>(
    PREVIEW,
    { input: { rule, ...page } },
  );
  return previewStoreCollectionMatches;
}
