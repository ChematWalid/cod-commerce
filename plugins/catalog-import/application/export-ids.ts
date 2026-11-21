import { CATALOG_MAX_PAGE_SIZE } from '@cod/shared';
import type { ExportFilter } from '../domain/export-target';
import type { StoreScope } from '../domain/store-scope';
import type { CatalogExportReadsPort, ExportIdsPage } from './ports/catalog-export-reads.port';
import type { OperationContext } from './ports/operation-context';

/** The ids to read for a filtered export, and where the paging starts. */
export interface FilteredIdsRequest {
  readonly filter: ExportFilter;
  /** Most ids kept; one more found means the filter holds too many. */
  readonly limit: number;
  /** The first page, when the caller already read it. */
  readonly first?: ExportIdsPage;
}

/** The first page of a filter's ids, at the largest page size (D2218). */
export function firstIdsPage(
  reads: Pick<CatalogExportReadsPort, 'idsPage'>,
  ctx: OperationContext,
  scope: StoreScope,
  filter: ExportFilter,
): Promise<ExportIdsPage> {
  return reads.idsPage(ctx, scope, { filter, skip: 0, take: CATALOG_MAX_PAGE_SIZE });
}

/**
 * Every id the filter finds in the scope's store, ascending and each once (D2218), or `undefined` when there are
 * more than `request.limit` (D2211).
 */
export async function filteredIds(
  reads: Pick<CatalogExportReadsPort, 'idsPage'>,
  ctx: OperationContext,
  scope: StoreScope,
  request: FilteredIdsRequest,
): Promise<string[] | undefined> {
  const ids = new Set<string>();
  let page = request.first ?? (await firstIdsPage(reads, ctx, scope, request.filter));
  for (;;) {
    for (const id of page.ids) ids.add(id);
    if (ids.size > request.limit) return undefined;
    if (page.nextSkip === null) return [...ids];
    page = await reads.idsPage(ctx, scope, {
      filter: request.filter,
      skip: page.nextSkip,
      take: CATALOG_MAX_PAGE_SIZE,
    });
  }
}
