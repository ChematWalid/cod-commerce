import { PRICING_ERROR_CODES } from '@cod/shared';
import { catalogOf } from './catalog-world';
import type { IsolationEntity } from './matrix';
import { offersOf } from './offers-rows';
import type { BusinessWorld } from './world-types';

/**
 * Every offers endpoint (P2.S5) as the P2 matrix calls it: each Admin API operation and each REST route, the matrix
 * row it belongs to, and what a caller of another business gets when it names the target's ids. The offers cells
 * (`cases/offers-sweep.ts`) are built from these lists, so a new endpoint is one entry here. Offer ids are `String`
 * on GraphQL (D2535), so GraphQL and REST name the same ids.
 */

/** The rows of a business a call may name. */
export interface OffersTarget {
  /** The offer holding {@link code}: the shared code's offer (D2528). */
  readonly offerId: string;
  readonly code: string;
  /** The catalog product, as the `productId` list filter takes it (no `T_` prefix). */
  readonly productId: string;
  readonly variantId: string;
}

/**
 * What a caller of another business gets when it names the target's ids:
 * - `null`: a read of none (`offer`);
 * - `not-found`: `offers.offer-not-found` (REST 404);
 * - `own-only`: a successful answer about its own store only (the list filtered by the target's product);
 * - `no-read`: a successful answer computed from the input alone (the preview, D2516), or one that names no id;
 * - `dangling`: a create that keeps the target's variant id as a plain reference (D2536). It writes a row in the
 *   caller's store, so the server matrix sends it only on the refused channels; the plugin sweep covers it.
 */
export type OffersForeign = 'null' | 'not-found' | 'own-only' | 'no-read' | 'dangling';

/** One Admin API operation. */
export interface OffersOperation {
  readonly name: string;
  readonly entity: IsolationEntity;
  readonly foreign: OffersForeign;
  readonly document: string;
  readonly variables: (target: OffersTarget) => Record<string, unknown>;
}

/** One REST route. */
export interface OffersRoute {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** The route as the controller declares it, e.g. `/offers/:id`. */
  readonly route: string;
  readonly entity: IsolationEntity;
  readonly foreign: OffersForeign;
  readonly path: (target: OffersTarget) => string;
  readonly body?: (target: OffersTarget) => Record<string, unknown>;
}

/** The rows of `business` a call names. */
export function offersTargetOf(business: BusinessWorld): OffersTarget {
  const offers = offersOf(business);
  return {
    offerId: offers.sharedCodeOfferId,
    code: offers.sharedCode,
    productId: catalogOf(business).product.restId,
    variantId: offers.variantId,
  };
}

/** Every offer of `business`'s first store: its own list must hold each. */
export const ownOfferIdsOf = (business: BusinessWorld): string[] => {
  const offers = offersOf(business);
  return [offers.automaticOfferId, offers.codeOfferId, offers.sharedCodeOfferId];
};

export const OFFER_NOT_FOUND = PRICING_ERROR_CODES.OFFER_NOT_FOUND;

/** A quantity draft activated by codes on the target's variant: what a create or a preview sends. */
const offerNaming = (target: OffersTarget): Record<string, unknown> => ({
  kind: 'quantity',
  method: 'codes',
  title: 'Synthetic offer',
  config: { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] },
  targets: [{ refType: 'variant', refId: target.variantId }],
});

/** A lifecycle mutation of one offer id, answering its view. */
const moveOperation = (name: string): OffersOperation => ({
  name,
  entity: 'offer',
  foreign: 'not-found',
  document: `mutation ($id: String!) { ${name}(id: $id) { id } }`,
  variables: (t) => ({ id: t.offerId }),
});

const OFFER_OPERATIONS: readonly OffersOperation[] = [
  {
    name: 'offers',
    entity: 'offer',
    foreign: 'own-only',
    document: 'query ($options: OfferListInput) { offers(options: $options) { totalItems items { id } } }',
    variables: (t) => ({ options: { productId: t.productId } }),
  },
  {
    name: 'offer',
    entity: 'offer',
    foreign: 'null',
    document: 'query ($id: String!) { offer(id: $id) { id title } }',
    variables: (t) => ({ id: t.offerId }),
  },
  {
    name: 'offerStats',
    entity: 'offer',
    foreign: 'not-found',
    document: 'query ($id: String!) { offerStats(id: $id) { orders } }',
    variables: (t) => ({ id: t.offerId }),
  },
  {
    name: 'offerAppTypes',
    entity: 'offer',
    foreign: 'no-read',
    document: 'query { offerAppTypes { id } }',
    variables: () => ({}),
  },
  {
    name: 'previewOffer',
    entity: 'offer',
    foreign: 'no-read',
    document: 'query ($input: OfferPreviewInput!) { previewOffer(input: $input) { warnings } }',
    variables: (t) => ({ input: { offer: offerNaming(t) } }),
  },
  {
    name: 'createOffer',
    entity: 'offer',
    foreign: 'dangling',
    document: 'mutation ($input: CreateOfferInput!) { createOffer(input: $input) { id targets { refId } } }',
    variables: (t) => ({ input: offerNaming(t) }),
  },
  {
    name: 'updateOffer',
    entity: 'offer',
    foreign: 'not-found',
    document: 'mutation ($id: String!, $input: UpdateOfferInput!) { updateOffer(id: $id, input: $input) { id } }',
    variables: (t) => ({ id: t.offerId, input: { title: 'Synthetic' } }),
  },
  ...['publishOffer', 'pauseOffer', 'resumeOffer', 'archiveOffer', 'duplicateOffer'].map(moveOperation),
  {
    name: 'deleteOffer',
    entity: 'offer',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { deleteOffer(id: $id) }',
    variables: (t) => ({ id: t.offerId }),
  },
];

const CODE_OPERATIONS: readonly OffersOperation[] = [
  {
    name: 'offerCodes',
    entity: 'offer code',
    foreign: 'not-found',
    document: 'query ($offerId: String!) { offerCodes(offerId: $offerId) { id code } }',
    variables: (t) => ({ offerId: t.offerId }),
  },
  {
    name: 'addOfferCodes',
    entity: 'offer code',
    foreign: 'not-found',
    document:
      'mutation ($offerId: String!, $codes: [OfferCodeInput!]!) { addOfferCodes(offerId: $offerId, codes: $codes) { id } }',
    variables: (t) => ({ offerId: t.offerId, codes: [{ code: t.code }] }),
  },
  {
    name: 'generateOfferCodes',
    entity: 'offer code',
    foreign: 'not-found',
    document:
      'mutation ($offerId: String!, $input: GenerateOfferCodesInput!) { generateOfferCodes(offerId: $offerId, input: $input) { id } }',
    variables: (t) => ({ offerId: t.offerId, input: { count: 2 } }),
  },
  {
    name: 'removeOfferCode',
    entity: 'offer code',
    foreign: 'not-found',
    document: 'mutation ($offerId: String!, $code: String!) { removeOfferCode(offerId: $offerId, code: $code) }',
    variables: (t) => ({ offerId: t.offerId, code: t.code }),
  },
];

/** Every Admin API operation of the offers plugin. */
export const OFFERS_OPERATIONS: readonly OffersOperation[] = [...OFFER_OPERATIONS, ...CODE_OPERATIONS];

const offerPath =
  (suffix = '') =>
  (t: OffersTarget): string =>
    `/offers/${t.offerId}${suffix}`;

/** A lifecycle route of one offer id. */
const moveRoute = (move: string): OffersRoute => ({
  method: 'POST',
  route: `/offers/:id/${move}`,
  entity: 'offer',
  foreign: 'not-found',
  path: offerPath(`/${move}`),
});

const OFFER_ROUTES: readonly OffersRoute[] = [
  {
    method: 'GET',
    route: '/offers',
    entity: 'offer',
    foreign: 'own-only',
    path: (t) => `/offers?productId=${t.productId}`,
  },
  { method: 'GET', route: '/offers/app-types', entity: 'offer', foreign: 'no-read', path: () => '/offers/app-types' },
  {
    method: 'POST',
    route: '/offers/preview',
    entity: 'offer',
    foreign: 'no-read',
    path: () => '/offers/preview',
    body: (t) => ({ offer: offerNaming(t) }),
  },
  { method: 'GET', route: '/offers/:id', entity: 'offer', foreign: 'not-found', path: offerPath() },
  { method: 'GET', route: '/offers/:id/stats', entity: 'offer', foreign: 'not-found', path: offerPath('/stats') },
  { method: 'POST', route: '/offers', entity: 'offer', foreign: 'dangling', path: () => '/offers', body: offerNaming },
  {
    method: 'PATCH',
    route: '/offers/:id',
    entity: 'offer',
    foreign: 'not-found',
    path: offerPath(),
    body: () => ({ title: 'Synthetic' }),
  },
  ...['publish', 'pause', 'resume', 'archive', 'duplicate'].map(moveRoute),
  { method: 'DELETE', route: '/offers/:id', entity: 'offer', foreign: 'not-found', path: offerPath() },
];

const CODE_ROUTES: readonly OffersRoute[] = [
  { method: 'GET', route: '/offers/:id/codes', entity: 'offer code', foreign: 'not-found', path: offerPath('/codes') },
  {
    method: 'POST',
    route: '/offers/:id/codes',
    entity: 'offer code',
    foreign: 'not-found',
    path: offerPath('/codes'),
    body: (t) => ({ codes: [{ code: t.code }] }),
  },
  {
    method: 'POST',
    route: '/offers/:id/codes/generate',
    entity: 'offer code',
    foreign: 'not-found',
    path: offerPath('/codes/generate'),
    body: () => ({ count: 2 }),
  },
  {
    method: 'DELETE',
    route: '/offers/:id/codes/:code',
    entity: 'offer code',
    foreign: 'not-found',
    path: (t) => `/offers/${t.offerId}/codes/${encodeURIComponent(t.code)}`,
  },
];

/** Every REST route of the offers plugin. */
export const OFFERS_ROUTES: readonly OffersRoute[] = [...OFFER_ROUTES, ...CODE_ROUTES];
