import { readRequestToken, sendForStore, type StoreScope, storeQuery } from '@cod/plugin-merchant-shell/shell-api';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import { PACK_CANDIDATES_QUERY_KEY, PACK_PRODUCT_QUERY_KEY, PACK_QUERY_KEY, PICKER_PAGE_SIZE } from './constants';
import type { PickableProduct } from './model/pack-components';
import type { PackInput } from './model/pack-form';

/** What the block reads of the edited product: its type decides whether the block acts. */
export interface PackProductDto {
  readonly id: string;
  readonly type: string;
  readonly price: number;
}

/** A stored pack (`CatalogPack`). */
export interface CatalogPackDto extends PackInput {
  readonly status: 'ok' | 'stale';
  readonly price: number;
  readonly weightGrams: number | null;
}

/** `CatalogPackPreview`: the computed price and weight, and the price of each shared value. */
export interface CatalogPackPreviewDto {
  readonly price: number;
  readonly weightGrams: number;
  readonly sharedValues: readonly { readonly value: string; readonly price: number }[];
}

const PACK_FIELDS = `status packPricingMode packFixedPrice packDiscountType packDiscountValue packVariantMode
  packSharedOption packWeightMode packFixedWeightGrams components { productId variantId quantity } price weightGrams`;
const PRODUCT_QUERY = 'query PacksProduct($id: ID!) { catalogProduct(id: $id) { id type price } }';
const PACK_QUERY = `query PacksPack($productId: ID!) { catalogPack(productId: $productId) { ${PACK_FIELDS} } }`;
const CANDIDATES_QUERY = `query PacksCandidates($options: CatalogProductListInput) {
  catalogProducts(options: $options) { items { id title type variants { id name } } } }`;
const SAVE_MUTATION = `mutation PacksSave($productId: ID!, $input: CatalogPackInput!) {
  saveCatalogPack(productId: $productId, input: $input) { ${PACK_FIELDS} } }`;
const PREVIEW_MUTATION = `mutation PacksPreview($input: CatalogPackInput!) {
  previewCatalogPack(input: $input) { price weightGrams sharedValues { value price } } }`;

/** A write sent only while requests go to `scope`'s store; the answer's shape is the document's. */
async function mutate<T>(scope: StoreScope | null, document: string, variables: object): Promise<T> {
  return (await sendForStore(scope?.channelToken ?? null, readRequestToken, () =>
    api.mutate(document, variables),
  )) as T;
}

/** The edited product's id, type and stored price; `null` when the store has no such product. */
export function usePackProduct(scope: StoreScope | null, productId: string | null) {
  return useQuery({
    ...storeQuery(
      PACK_PRODUCT_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogProduct: PackProductDto | null }>(PRODUCT_QUERY, { id: productId }))
          .catalogProduct,
      { productId },
    ),
    enabled: productId !== null,
  });
}

/** The stored pack of a pack product; `null` while it is not composed yet (D2227). */
export function useCatalogPack(scope: StoreScope | null, productId: string, enabled: boolean) {
  return useQuery({
    ...storeQuery(
      PACK_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogPack: CatalogPackDto | null }>(PACK_QUERY, { productId })).catalogPack,
      { productId },
    ),
    enabled,
  });
}

/** The store's products matching `search`, one page, for the component picker. */
export function usePackCandidates(scope: StoreScope | null, search: string) {
  const options = { q: search.trim() === '' ? undefined : search.trim(), take: PICKER_PAGE_SIZE };
  return useQuery(
    storeQuery(
      PACK_CANDIDATES_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly catalogProducts: { readonly items: readonly PickableProduct[] } }>(
            CANDIDATES_QUERY,
            { options },
          )
        ).catalogProducts.items,
      options,
    ),
  );
}

/** Saves the pack of `productId`; catalog-packs writes its price, weight and variants (D2203). */
export const saveCatalogPack = async (
  scope: StoreScope | null,
  productId: string,
  input: PackInput,
): Promise<CatalogPackDto> =>
  (await mutate<{ readonly saveCatalogPack: CatalogPackDto }>(scope, SAVE_MUTATION, { productId, input }))
    .saveCatalogPack;

/** Computes a pack's price and weight without saving. */
export const previewCatalogPack = async (scope: StoreScope | null, input: PackInput): Promise<CatalogPackPreviewDto> =>
  (await mutate<{ readonly previewCatalogPack: CatalogPackPreviewDto }>(scope, PREVIEW_MUTATION, { input }))
    .previewCatalogPack;

/** One aliased `catalogProduct` read per component, so a stored pack shows each component's title and variants. */
function componentsDocument(count: number): string {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const variables = indexes.map((index) => `$p${String(index)}: ID!`).join(', ');
  const fields = indexes
    .map((index) => `p${String(index)}: catalogProduct(id: $p${String(index)}) { id title type variants { id name } }`)
    .join(' ');
  return `query PacksComponents(${variables}) { ${fields} }`;
}

/** The component products of a stored pack, by id; one the store no longer holds is left out. */
export function usePackComponentProducts(scope: StoreScope | null, productIds: readonly string[]) {
  const variables = Object.fromEntries(productIds.map((id, index) => [`p${String(index)}`, id]));
  return useQuery({
    ...storeQuery(
      [...PACK_CANDIDATES_QUERY_KEY, 'components'],
      scope,
      async () => {
        const answer = await api.query<Record<string, PickableProduct | null>>(
          componentsDocument(productIds.length),
          variables,
        );
        const found = Object.values(answer).filter((product): product is PickableProduct => product !== null);
        return new Map(found.map((product) => [product.id, product]));
      },
      { productIds },
    ),
    enabled: productIds.length > 0,
  });
}
