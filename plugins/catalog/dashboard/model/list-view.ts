import { CATALOG_ERROR_CODES, type ProductListTab, type ProductStatus } from '@cod/shared';
import { DELETE_PRODUCTS_KEY, EDIT_PRODUCTS_KEY } from '../constants';

/** The catalogue ids of the statuses and tabs; `dynamic-ids.ts` registers every one of them. */
export const STATUS_LABEL_IDS: Readonly<Record<ProductStatus, string>> = {
  active: 'catalog.status-active',
  hidden: 'catalog.status-hidden',
  draft: 'catalog.status-draft',
};

export const TAB_LABEL_IDS: Readonly<Record<ProductListTab, string>> = {
  all: 'catalog.tab-all',
  draft: 'catalog.tab-draft',
};

/** A row's actions, in menu order. Preview stays disabled until the storefront exists (P3.S2). */
export type ProductRowAction = 'edit' | 'set-draft' | 'preview' | 'delete';

export const ROW_ACTION_LABEL_IDS: Readonly<Record<ProductRowAction, string>> = {
  edit: 'catalog.action-edit',
  'set-draft': 'catalog.action-set-draft',
  preview: 'catalog.action-preview',
  delete: 'catalog.action-delete',
};

/**
 * The actions a row offers, by what the server says the caller holds; the server checks each again. Edit opens the
 * editor, which needs only the view key to read the product.
 */
export function rowActionsOf(
  product: { readonly status: ProductStatus },
  held: ReadonlySet<string>,
): readonly ProductRowAction[] {
  const canSetDraft = held.has(EDIT_PRODUCTS_KEY) && product.status !== 'draft';
  return [
    'edit',
    ...(canSetDraft ? (['set-draft'] as const) : []),
    'preview',
    ...(held.has(DELETE_PRODUCTS_KEY) ? (['delete'] as const) : []),
  ];
}

export const GENERIC_ERROR_MESSAGE_ID = 'catalog.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'catalog.error-forbidden';

const FORBIDDEN_CODE = 'FORBIDDEN';
const CATALOG_CODES: ReadonlySet<string> = new Set(Object.values(CATALOG_ERROR_CODES));

function graphQlCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error: the catalog code's own message, forbidden, or a generic one. */
export function listErrorMessageId(error: unknown): string {
  const code = graphQlCodeOf(error);
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  return code !== undefined && CATALOG_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}

/** Whole DZD with the display language's grouping and Latin digits, as amounts are written in Algeria. */
export function formatDzd(amount: number, language: string): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-DZ' : 'en', { numberingSystem: 'latn' }).format(amount);
}
