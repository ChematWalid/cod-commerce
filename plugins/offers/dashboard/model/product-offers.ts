import type { OfferStatus } from '@cod/shared';
import { CREATE_OFFERS_KEY, NEW_OFFER_PATH, VIEW_OFFERS_KEY } from '../constants';
import type { OfferListInput, OfferPageDto } from '../dto';
import { kindLabelIdOf } from './app-type-cards';
import { FORBIDDEN_MESSAGE_ID, listErrorMessageId, STATUS_LABEL_IDS } from './list-view';

/** Offers the block lists at once; more are counted, not shown (the offers list holds them all). */
export const PRODUCT_OFFERS_TAKE = 10;

/** The app type the block's link opens: a quantity offer bought on this product (D2524). */
const QUANTITY_APP_TYPE_ID = 'quantity';

/** What the block reads of its offers query (TanStack's result, narrowed to what decides the view). */
export interface ProductOffersAnswer {
  readonly data: OfferPageDto | undefined;
  readonly isError: boolean;
  readonly error: unknown;
  readonly isPlaceholderData: boolean;
}

/** An offer of the product as the block shows it. */
export interface ProductOfferRow {
  readonly id: string;
  readonly title: string;
  readonly kindLabelId: string;
  readonly status: OfferStatus;
  readonly statusLabelId: string;
}

/** What the block shows: nothing, a notice, or the product's offers with the count left out and the create link. */
export type ProductOffersView =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly messageId: string }
  | {
      readonly kind: 'list';
      readonly rows: readonly ProductOfferRow[];
      readonly moreCount: number;
      readonly canCreate: boolean;
    };

/** The list options of the block's query: the first offers that target the product or one of its variants. */
export const productOffersQueryOf = (productId: string): OfferListInput => ({
  productId,
  skip: 0,
  take: PRODUCT_OFFERS_TAKE,
});

/** Where "Add a quantity offer" goes: the new-offer route, its card and buy target given by the search (D2523). */
export const newQuantityOfferLinkOf = (productId: string) =>
  ({ path: NEW_OFFER_PATH, search: { type: QUANTITY_APP_TYPE_ID, productId } }) as const;

/**
 * Whether the block's card renders at all: on a saved product, once the server says the caller holds `offers.view` on
 * the store (the plugin's own permission read; the shell exports none, D2524). The card would otherwise show its title
 * over an empty body.
 */
export const productOffersShown = (productId: string | undefined, held: ReadonlySet<string>): boolean =>
  productId !== undefined && held.has(VIEW_OFFERS_KEY);

function listViewOf(page: OfferPageDto, held: ReadonlySet<string>): ProductOffersView {
  const rows = page.items.map((offer) => ({
    id: offer.id,
    title: offer.title,
    kindLabelId: kindLabelIdOf(offer.kind),
    status: offer.status,
    statusLabelId: STATUS_LABEL_IDS[offer.status],
  }));
  return {
    kind: 'list',
    rows,
    moreCount: Math.max(0, page.totalItems - rows.length),
    canCreate: held.has(CREATE_OFFERS_KEY),
  };
}

/**
 * Decides the block (D2524). A new product has no offers to list; a member without `offers.view` gets a `FORBIDDEN`
 * answer, which hides the block instead of showing an error (the shell exports no permission hook to ask first). The
 * link shows only with `offers.create`, the key the new-offer route asks for; the server checks each again.
 */
export function productOffersViewOf(
  productId: string | undefined,
  answer: ProductOffersAnswer,
  held: ReadonlySet<string>,
): ProductOffersView {
  if (productId === undefined) return { kind: 'hidden' };
  if (answer.data === undefined || answer.isPlaceholderData) {
    if (!answer.isError) return { kind: 'loading' };
    const messageId = listErrorMessageId(answer.error);
    return messageId === FORBIDDEN_MESSAGE_ID ? { kind: 'hidden' } : { kind: 'error', messageId };
  }
  return listViewOf(answer.data, held);
}
