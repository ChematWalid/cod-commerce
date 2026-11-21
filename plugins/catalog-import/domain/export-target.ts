import type { ProductListQuery } from '@cod/shared';
import { PROGRESS_DONE } from './constants';

/** The product list's tab, search and filters, without its page: what a filtered export exports (D2211). */
export type ExportFilter = Omit<ProductListQuery, 'skip' | 'take'>;

/** Which products an export writes: the selected ids, or every product the list's filter finds. */
export type ExportTarget =
  | { readonly kind: 'selected'; readonly productIds: readonly string[] }
  | { readonly kind: 'filtered'; readonly filter: ExportFilter };

/** The filter of a list query; the page is the export's own business. */
export function exportFilterOf(query: ProductListQuery): ExportFilter {
  const q = 'q' in query ? query.q : undefined;
  const optional = { q, collectionId: query.collectionId, brandId: query.brandId, tagId: query.tagId };
  const given = Object.entries(optional).filter(([, value]) => value !== undefined);
  return { tab: query.tab, ...(Object.fromEntries(given) as Partial<ExportFilter>) };
}

/** A percentage of `done` out of `total`, rounded down; an empty export is done. */
export function percentOf(done: number, total: number): number {
  if (total === 0) return PROGRESS_DONE;
  return Math.min(PROGRESS_DONE, Math.floor((done * PROGRESS_DONE) / total));
}
