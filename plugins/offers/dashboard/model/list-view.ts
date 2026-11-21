import { PRICING_ERROR_CODES, type OfferMethod, type OfferPerformance, type OfferStatus } from '@cod/shared';
import { CREATE_OFFERS_KEY, DELETE_OFFERS_KEY, EDIT_OFFERS_KEY } from '../constants';
import type { OfferRowDto } from '../dto';
import type { OfferListTab } from './list-search';
import { isStoreSwitched } from './store-bound-fetch';

/** The catalogue ids of the statuses, tabs and methods; literal ids, so the i18n scan sees every one. */
export const STATUS_LABEL_IDS: Readonly<Record<OfferStatus, string>> = {
  draft: 'offers.status-draft',
  active: 'offers.status-active',
  paused: 'offers.status-paused',
  archived: 'offers.status-archived',
};

export const TAB_LABEL_IDS: Readonly<Record<OfferListTab, string>> = {
  all: 'offers.tab-all',
  draft: 'offers.tab-draft',
  active: 'offers.tab-active',
  paused: 'offers.tab-paused',
  archived: 'offers.tab-archived',
};

const METHOD_LABEL_IDS: Readonly<Record<OfferMethod, string>> = {
  automatic: 'offers.method-automatic',
  codes: 'offers.method-codes',
};

/** A row's actions, in menu order. */
export type OfferRowAction = 'edit' | 'duplicate' | 'pause' | 'resume' | 'archive' | 'delete';

export const ROW_ACTION_LABEL_IDS: Readonly<Record<OfferRowAction, string>> = {
  edit: 'offers.action-edit',
  duplicate: 'offers.action-duplicate',
  pause: 'offers.action-pause',
  resume: 'offers.action-resume',
  archive: 'offers.action-archive',
  delete: 'offers.action-delete',
};

/** The moves a row's menu makes, in menu order; publishing is the editor's, after its checks. */
const ROW_MOVES = ['pause', 'resume', 'archive'] as const satisfies readonly OfferRowAction[];

/**
 * The actions a row offers: the moves and the deletion the server allows the offer (D2543), as far as the caller's
 * keys reach; the server checks each again. Edit opens the editor, which needs only the view key to read the offer.
 */
export function rowActionsOf(
  offer: Pick<OfferRowDto, 'allowedMoves' | 'deletable'>,
  held: ReadonlySet<string>,
): readonly OfferRowAction[] {
  const moves = held.has(EDIT_OFFERS_KEY) ? ROW_MOVES.filter((move) => offer.allowedMoves.includes(move)) : [];
  return [
    'edit',
    ...(held.has(CREATE_OFFERS_KEY) ? (['duplicate'] as const) : []),
    ...moves,
    ...(held.has(DELETE_OFFERS_KEY) && offer.deletable ? (['delete'] as const) : []),
  ];
}

/** The method column: its label, and the number of codes when the offer is activated by codes. */
export function methodCellOf(offer: { readonly method: OfferMethod; readonly codeCount: number }): {
  readonly labelId: string;
  readonly codeCount: number | null;
} {
  return { labelId: METHOD_LABEL_IDS[offer.method], codeCount: offer.method === 'codes' ? offer.codeCount : null };
}

export const GENERIC_ERROR_MESSAGE_ID = 'offers.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'offers.error-forbidden';
/** A write refused because the page's store is no longer the one requests go to. */
export const STORE_SWITCHED_MESSAGE_ID = 'offers.error-store-switched';

const FORBIDDEN_CODE = 'FORBIDDEN';
const OFFER_CODES: ReadonlySet<string> = new Set(Object.values(PRICING_ERROR_CODES));

function graphQlCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error: the offer code's own message, forbidden, a switched store, or a generic one. */
export function listErrorMessageId(error: unknown): string {
  if (isStoreSwitched(error)) return STORE_SWITCHED_MESSAGE_ID;
  const code = graphQlCodeOf(error);
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  return code !== undefined && OFFER_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}

/** Whole numbers with the display language's grouping and Latin digits, as amounts are written in Algeria. */
export function formatWhole(amount: number, language: string): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-DZ' : 'en', { numberingSystem: 'latn' }).format(amount);
}

/** The performance columns of a row (D2514): orders, and the two DZD sums, each grouped for `language`. */
export function performanceCellsOf(
  performance: OfferPerformance,
  language: string,
): Readonly<Record<keyof OfferPerformance, string>> {
  return {
    orders: formatWhole(performance.orders, language),
    deliveredRevenue: formatWhole(performance.deliveredRevenue, language),
    discountGiven: formatWhole(performance.discountGiven, language),
  };
}
