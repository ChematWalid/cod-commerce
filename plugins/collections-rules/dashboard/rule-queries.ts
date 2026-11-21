import { COLLECTION_LIST_MAX_TAKE, COLLECTIONS_PER_STORE_MAX } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  COLLECTION_CHOICES_QUERY_KEY,
  PREVIEW_ROWS,
  PRODUCT_COLLECTIONS_QUERY_KEY,
  RULE_OPTIONS_QUERY_KEY,
} from './constants';
import type {
  StoreCollectionDto,
  StoreCollectionPageDto,
  StoreCollectionProductPageDto,
  StoreCollectionRuleDto,
  StoreCollectionRuleOptionsDto,
  StoreProductCollectionsDto,
} from './dto';
import { type StoreScope, storeQuery } from './model/store-query';
import { COLLECTION_FIELDS } from './queries';

const RULE_OPTIONS_QUERY = `query StoreCollectionBuilderOptions {
  storeCollectionRuleOptions { brands { id name } tags { id name } options { name values } } }`;
const PREVIEW_QUERY = `query StoreCollectionPreview($input: StoreCollectionPreviewInput!) {
  previewStoreCollectionMatches(input: $input) { items { productId title status price } totalItems } }`;
const PRODUCT_COLLECTIONS_QUERY = `query StoreCollectionsOfProduct($productId: ID!) {
  storeProductCollections(productId: $productId) { manual { id title } automatic { id title } } }`;
const CHOICES_QUERY = `query StoreCollectionChoices($options: StoreCollectionListInput) {
  storeCollections(options: $options) { items { ${COLLECTION_FIELDS} } totalItems } }`;

/** The brands, tags and option names with values the rule builder offers for the active store (D2321). */
export function useRuleOptions(scope: StoreScope | null) {
  return useQuery(
    storeQuery(
      RULE_OPTIONS_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly storeCollectionRuleOptions: StoreCollectionRuleOptionsDto }>(RULE_OPTIONS_QUERY))
          .storeCollectionRuleOptions,
    ),
  );
}

/** The products an unsaved rule matches, newest first, and their count; nothing is saved (D2331). */
export const fetchPreview = async (rule: StoreCollectionRuleDto): Promise<StoreCollectionProductPageDto> =>
  (
    await api.query<{ readonly previewStoreCollectionMatches: StoreCollectionProductPageDto }>(PREVIEW_QUERY, {
      input: { rule, skip: 0, take: PREVIEW_ROWS },
    })
  ).previewStoreCollectionMatches;

/** The manual and automatic collections of one product of the active store (D2324). */
export function useProductCollections(scope: StoreScope | null, productId: string) {
  return useQuery(
    storeQuery(
      PRODUCT_COLLECTIONS_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly storeProductCollections: StoreProductCollectionsDto }>(PRODUCT_COLLECTIONS_QUERY, {
            productId,
          })
        ).storeProductCollections,
      { productId },
    ),
  );
}

/** Every collection of the active store, page after page up to the store's cap (D2322), for the product block. */
async function allCollections(): Promise<readonly StoreCollectionDto[]> {
  const collected: StoreCollectionDto[] = [];
  for (let skip = 0; skip < COLLECTIONS_PER_STORE_MAX; skip += COLLECTION_LIST_MAX_TAKE) {
    const { storeCollections } = await api.query<{ readonly storeCollections: StoreCollectionPageDto }>(CHOICES_QUERY, {
      options: { skip, take: COLLECTION_LIST_MAX_TAKE },
    });
    collected.push(...storeCollections.items);
    if (collected.length >= storeCollections.totalItems || storeCollections.items.length === 0) break;
  }
  return collected;
}

export function useCollectionChoices(scope: StoreScope | null) {
  return useQuery(storeQuery(COLLECTION_CHOICES_QUERY_KEY, scope, allCollections));
}
