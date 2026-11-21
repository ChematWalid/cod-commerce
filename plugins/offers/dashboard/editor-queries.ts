import type { OfferInput, OfferPreview, OfferPreviewInput } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  OFFER_QUERY_KEY,
  PREVIEW_QUERY_KEY,
  TARGET_PRODUCT_QUERY_KEY,
  TARGET_PRODUCTS_QUERY_KEY,
  TARGET_SEARCH_TAKE,
} from './constants';
import type { OfferViewDto, TargetProductDetailDto, TargetProductDto } from './dto';
import type { OfferPatch } from './model/editor-patch';
import { sendForStore } from './model/store-bound-fetch';
import { readRequestToken, type StoreScope, storeQuery } from './queries';

/** Every field of an offer the editor reads back after a load or a save. */
const OFFER_FIELDS = `
  id kind method title label config combinesWith eligibility totalUsageLimit perBuyerLimit status
  startsAt endsAt version targets { role refType refId } codeCount allowedMoves editable`;

const OFFER_QUERY = `query OfferEditor($id: String!) { offer(id: $id) { ${OFFER_FIELDS} } }`;
const CREATE_MUTATION = `mutation OfferCreate($input: CreateOfferInput!) { createOffer(input: $input) { ${OFFER_FIELDS} } }`;
const UPDATE_MUTATION = `mutation OfferUpdate($id: String!, $input: UpdateOfferInput!, $version: Int) {
  updateOffer(id: $id, input: $input, version: $version) { ${OFFER_FIELDS} } }`;
const PUBLISH_MUTATION = `mutation OfferPublish($id: String!) { publishOffer(id: $id) { ${OFFER_FIELDS} } }`;
const PREVIEW_QUERY = `query OfferPreview($input: OfferPreviewInput!) {
  previewOffer(input: $input) { scenarios { pieces addonAccepted quote } warnings } }`;
/** The catalog's Admin API (P2.S1), read for the target picker; the catalog's code is never imported (§3a.2). */
const TARGET_PRODUCTS_QUERY = `query OfferTargetProducts($options: CatalogProductListInput) {
  catalogProducts(options: $options) { items { id title price } } }`;
const TARGET_PRODUCT_QUERY = `query OfferTargetProduct($id: ID!) {
  catalogProduct(id: $id) { id title price variants { id name price } } }`;

/** A write sent only while requests go to `scope`'s store ({@link sendForStore}). */
export async function mutateForStore<T>(scope: StoreScope | null, document: string, variables: object): Promise<T> {
  return (await sendForStore(scope?.channelToken ?? null, readRequestToken, () =>
    api.mutate(document, variables),
  )) as T;
}

/** The offer the editor opens, `null` when the active store has no such offer (D2535(e)). */
export function useOffer(scope: StoreScope | null, offerId: string | null) {
  return useQuery({
    ...storeQuery(
      OFFER_QUERY_KEY,
      scope,
      async () => (await api.query<{ readonly offer: OfferViewDto | null }>(OFFER_QUERY, { id: offerId })).offer,
      { offerId },
    ),
    enabled: offerId !== null,
  });
}

/** Creates a draft in `scope`'s store; refused unsent when requests go to another store. */
export const createOffer = async (scope: StoreScope | null, input: OfferInput): Promise<OfferViewDto> =>
  (await mutateForStore<{ readonly createOffer: OfferViewDto }>(scope, CREATE_MUTATION, { input })).createOffer;

/** Saves the changed fields of an offer of `scope`'s store, made on `patch.version`. */
export const updateOffer = async (scope: StoreScope | null, id: string, patch: OfferPatch): Promise<OfferViewDto> =>
  (await mutateForStore<{ readonly updateOffer: OfferViewDto }>(scope, UPDATE_MUTATION, { id, ...patch })).updateOffer;

/** Takes a draft live (D2510); refused with its publish problems when the draft is incomplete. */
export const publishOffer = async (scope: StoreScope | null, id: string): Promise<OfferViewDto> =>
  (await mutateForStore<{ readonly publishOffer: OfferViewDto }>(scope, PUBLISH_MUTATION, { id })).publishOffer;

/** The preview of `input`, waiting while there is none (D2516); nothing is written. */
export function useOfferPreview(scope: StoreScope | null, input: OfferPreviewInput | null) {
  return useQuery({
    ...storeQuery(
      PREVIEW_QUERY_KEY,
      scope,
      async () => (await api.query<{ readonly previewOffer: OfferPreview }>(PREVIEW_QUERY, { input })).previewOffer,
      { input },
    ),
    enabled: input !== null,
  });
}

/** Products of the active store whose name matches `q`, for the target picker. */
export function useTargetProducts(scope: StoreScope | null, q: string) {
  const options = { q, take: TARGET_SEARCH_TAKE };
  return useQuery({
    ...storeQuery(
      TARGET_PRODUCTS_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly catalogProducts: { readonly items: readonly TargetProductDto[] } }>(
            TARGET_PRODUCTS_QUERY,
            { options },
          )
        ).catalogProducts.items,
      options,
    ),
    enabled: q.trim() !== '',
  });
}

/** One product with its variants, `null` when the store no longer has it (a target shown as missing, D2523). */
export function useTargetProduct(scope: StoreScope | null, productId: string | null) {
  return useQuery({
    ...storeQuery(
      TARGET_PRODUCT_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly catalogProduct: TargetProductDetailDto | null }>(TARGET_PRODUCT_QUERY, {
            id: productId,
          })
        ).catalogProduct,
      { productId },
    ),
    enabled: productId !== null,
  });
}
