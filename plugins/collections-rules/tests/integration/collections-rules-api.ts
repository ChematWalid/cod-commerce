import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import type { GraphqlRefusal } from './collections-api';
import type { CollectionsKit, RestAnswer } from './collections-kit';

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

/** The collections throttles refill one call every two seconds (30 a minute, D2338). */
const REFILL_MS = 2_000;
/** Calls sent past the budget, so a refill during a slow burst cannot hide the limit. */
const OVERSHOOT = 10;
const TOO_MANY_REQUESTS = 429;

/** What a burst past a throttle budget answered. */
export interface BudgetBurst {
  /** The GraphQL codes of the burst, `undefined` for an answered call. */
  readonly codes: readonly (string | undefined)[];
  /** How many of the burst must have been refused, whatever refilled while it ran; always at least one. */
  readonly minimumRefused: number;
  /** The `extensions.retryAfterSeconds` of the first rate-limited GraphQL refusal, if any. */
  readonly retryAfterSeconds: number | undefined;
  /** The first REST call refused after the burst, if any. */
  readonly limited: RestAnswer | undefined;
}

/** Thrown when a burst ran so long that the refill could have answered every call: the test would prove nothing. */
class BurstTooSlowError extends Error {
  constructor(elapsedMs: number) {
    super(`the burst took ${String(elapsedMs)} ms, past ${String(OVERSHOOT * REFILL_MS)} ms: the runner is too slow`);
  }
}

/**
 * Spends a fresh budget with `budget + OVERSHOOT` concurrent GraphQL calls, then calls REST until one is refused (at
 * most `OVERSHOOT` tries): the refill of a loaded runner lowers `minimumRefused` instead of turning the test red, but
 * never below one, so the GraphQL throttle stays pinned; a burst too slow for that fails loudly.
 */
export async function burstPastBudget(
  budget: number,
  graphql: () => Promise<GraphqlRefusal | undefined>,
  rest: () => Promise<RestAnswer>,
): Promise<BudgetBurst> {
  const started = Date.now();
  const refusals = await Promise.all(Array.from({ length: budget + OVERSHOOT }, graphql));
  const elapsedMs = Date.now() - started;
  const minimumRefused = OVERSHOOT - Math.floor(elapsedMs / REFILL_MS);
  if (minimumRefused < 1) throw new BurstTooSlowError(elapsedMs);
  const codes = refusals.map((refusal) => refusal?.code);
  const retryAfterSeconds = refusals.find(
    (refusal) => refusal?.code === COLLECTIONS_ERROR_CODES.RATE_LIMITED,
  )?.retryAfterSeconds;
  const answered = { codes, minimumRefused, retryAfterSeconds };
  for (let attempt = 0; attempt < OVERSHOOT; attempt += 1) {
    const answer = await rest();
    if (answer.status === TOO_MANY_REQUESTS) return { ...answered, limited: answer };
  }
  return { ...answered, limited: undefined };
}
