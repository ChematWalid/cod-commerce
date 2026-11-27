import { DELIVERY_PRICING_ERROR_CODES, FEE_GROUP_LIST_PAGE_SIZE } from '@cod/shared';
import { CREATE_PRICING_KEY, DELETE_PRICING_KEY, EDIT_PRICING_KEY, VIEW_PRICING_KEY } from '../constants';

export const GENERIC_ERROR_MESSAGE_ID = 'delivery-pricing.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'delivery-pricing.error-forbidden';
/** A request dropped because the page's store is no longer the one requests go to. */
export const STORE_SWITCHED_MESSAGE_ID = 'delivery-pricing.error-store-switched';
export const NO_CARRIER_MESSAGE_ID = 'delivery-pricing.no-carrier';
/** A carrier id the dashboard cannot name yet: carriers arrive with P5.S1 (D3109). */
export const UNKNOWN_CARRIER_MESSAGE_ID = 'delivery-pricing.carrier-unknown';

/** What a row of the list offers: open the editor to save (edit) or to read (view), copy (D3140) and delete. */
export type PricingRowAction = 'edit' | 'view' | 'copy' | 'delete';

export const ROW_ACTION_LABEL_IDS: Readonly<Record<PricingRowAction, string>> = {
  edit: 'delivery-pricing.action-edit',
  view: 'delivery-pricing.action-view',
  copy: 'delivery-pricing.action-copy',
  delete: 'delivery-pricing.action-delete',
};

/** The row actions the caller's keys allow; the server checks each again. */
export function rowActionsOf(held: ReadonlySet<string>): PricingRowAction[] {
  const actions: PricingRowAction[] = [];
  if (held.has(EDIT_PRICING_KEY)) actions.push('edit');
  else if (held.has(VIEW_PRICING_KEY)) actions.push('view');
  if (held.has(CREATE_PRICING_KEY)) actions.push('copy');
  if (held.has(DELETE_PRICING_KEY)) actions.push('delete');
  return actions;
}

/** A page of the list: its number (from 1) and the name search. */
export interface PricingListQuery {
  readonly page: number;
  readonly search: string;
}

/** The `deliveryFeeGroups` options of a page: a blank search is no search. */
export function listInputOf(query: PricingListQuery): { skip: number; take: number; search?: string } {
  const search = query.search.trim();
  const page = { skip: (query.page - 1) * FEE_GROUP_LIST_PAGE_SIZE, take: FEE_GROUP_LIST_PAGE_SIZE };
  return search === '' ? page : { ...page, search };
}

/** The page to show once the list holds `total` groups: the last one when `page` is past it. */
export function pageWithin(page: number, total: number): number {
  return Math.min(page, Math.max(1, Math.ceil(total / FEE_GROUP_LIST_PAGE_SIZE)));
}

/** The catalogue id of the carrier cell: "No carrier" until carriers exist (P5.S1). */
export const carrierLabelIdOf = (carrierId: string | null): string =>
  carrierId === null ? NO_CARRIER_MESSAGE_ID : UNKNOWN_CARRIER_MESSAGE_ID;

const FORBIDDEN_CODE = 'FORBIDDEN';
const PRICING_CODES: ReadonlySet<string> = new Set(Object.values(DELIVERY_PRICING_ERROR_CODES));

function graphQlCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id of an API error: the delivery-pricing code's own message, forbidden, or a generic one. */
export function errorMessageIdOf(error: unknown): string {
  const code = graphQlCodeOf(error);
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  return code !== undefined && PRICING_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}
