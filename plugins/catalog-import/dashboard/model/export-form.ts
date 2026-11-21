import {
  type CatalogProductListPageEntity,
  EXPORT_SYNC_MAX_ROWS,
  type ExportScope,
  type ImportFormat,
  type ProductListQuery,
} from '@cod/shared';

/** What the export dialog asks (D2211): which products, and in which format. */
export interface ExportForm {
  readonly scope: ExportScope;
  readonly format: ImportFormat;
}

/** The product list's filter without its page: a filtered export writes every product the filter finds. */
export type ExportFilterInput = ProductListQuery extends infer Query
  ? Query extends ProductListQuery
    ? Omit<Query, 'skip' | 'take'>
    : never
  : never;

/** The keys of the list's page, which a filtered export leaves out. */
const PAGE_KEYS: ReadonlySet<string> = new Set(['skip', 'take']);

/** `CatalogExportInput`: the ticked ids, or the list's filter. */
export type ExportInput =
  | { readonly scope: 'selected'; readonly format: ImportFormat; readonly productIds: readonly string[] }
  | { readonly scope: 'filtered'; readonly format: ImportFormat; readonly query: ExportFilterInput };

/** The input to send, or the catalogue id saying why the form cannot be sent. */
export type ExportRequest =
  { readonly ok: true; readonly input: ExportInput } | { readonly ok: false; readonly messageId: string };

export const EXPORT_SELECT_FIRST_MESSAGE_ID = 'catalog-import.export-select-first';
export const EXPORT_TOO_MANY_SELECTED_MESSAGE_ID = 'catalog-import.export-too-many-selected';

const DEFAULT_FORMAT: ImportFormat = 'xlsx';

/** The dialog's first choice: the ticked products when there are some, else the list's filter; Excel. */
export const defaultExportForm = (entity: CatalogProductListPageEntity | undefined): ExportForm => ({
  scope: (entity?.selectedIds.length ?? 0) > 0 ? 'selected' : 'filtered',
  format: DEFAULT_FORMAT,
});

/** The list's query without its page (`skip`, `take`). */
function filterOf(query: ProductListQuery): ExportFilterInput {
  return Object.fromEntries(Object.entries(query).filter(([key]) => !PAGE_KEYS.has(key))) as ExportFilterInput;
}

/**
 * The export to ask for, from the dialog's choices and what the list page hands its action bar (D2201): the ticked
 * ids (at least one, at most {@link EXPORT_SYNC_MAX_ROWS}, as the server checks again), or the list's filter.
 */
export function exportRequestOf(form: ExportForm, entity: CatalogProductListPageEntity): ExportRequest {
  if (form.scope === 'filtered')
    return { ok: true, input: { scope: 'filtered', format: form.format, query: filterOf(entity.query) } };
  if (entity.selectedIds.length === 0) return { ok: false, messageId: EXPORT_SELECT_FIRST_MESSAGE_ID };
  if (entity.selectedIds.length > EXPORT_SYNC_MAX_ROWS)
    return { ok: false, messageId: EXPORT_TOO_MANY_SELECTED_MESSAGE_ID };
  return { ok: true, input: { scope: 'selected', format: form.format, productIds: [...entity.selectedIds] } };
}
