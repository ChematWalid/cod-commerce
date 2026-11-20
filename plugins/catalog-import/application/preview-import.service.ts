import { IMPORT_PREVIEW_PAGE_MAX, type ImportPreviewQuery } from '@cod/shared';
import { type ColumnMap, type ColumnOverride, hasRequiredFields, mapColumns } from '../domain/column-mapper';
import { IMPORT_SKU_LOOKUP_BATCH } from '../domain/constants';
import { JobStateError, NoHeaderError } from '../domain/errors';
import type { PlanLookups, SkuLookup } from '../domain/plan-lookups';
import { type PlannedRow, planRows, productIdsToLookUp, skusToLookUp, taxonomyKey } from '../domain/row-plan';
import { validateRow } from '../domain/row-validate';
import type { ValidatedRow } from '../domain/import-row';
import type { StoreScope } from '../domain/store-scope';
import {
  dataRowsOf,
  headerCellsOf,
  importOf,
  type ImportSourceDeps,
  mappingHashOf,
  rawRowOf,
  readSource,
} from './import-source';
import { type ImportPreviewView, previewRowViewOf } from './import-view';
import type { CatalogImportPort } from './ports/catalog-import.port';
import type { ImportJobRecord, ImportJobStore, ImportPreviewSummary } from './ports/import-job.port';
import type { ImportRowStore } from './ports/import-row.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { OperationContext } from './ports/operation-context';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** What {@link PreviewImportService} runs through. */
export interface PreviewImportDeps extends ImportSourceDeps {
  readonly jobs: Pick<ImportJobStore, 'byId' | 'markPreviewed'>;
  readonly rows: Pick<ImportRowStore, 'replace' | 'page'>;
  readonly catalog: Pick<CatalogImportPort, 'findBySkus' | 'product' | 'taxonomyIndex'>;
  readonly storage: Pick<ObjectStorage, 'read'>;
  readonly units: UnitOfWorkPort;
  readonly now?: () => Date;
}

/** Statuses a preview may be computed from: analyzed, or previewed again with another mapping. */
const PREVIEWABLE = new Set(['analyzed', 'previewed']);
/** Statuses whose stored preview may be read. */
const HAS_PREVIEW = new Set(['previewed', 'confirming', 'running', 'done', 'failed']);

/** The preview's counts: rows by action, and applied rows carrying a warning. */
function summaryOf(rows: readonly PlannedRow[]): ImportPreviewSummary {
  const count = (action: string): number => rows.filter((row) => row.action === action).length;
  const warnings = rows.filter((row) => row.action !== 'error' && row.messages.length > 0).length;
  return { creates: count('create'), updates: count('update'), errors: count('error'), warnings };
}

const chunksOf = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

/**
 * "Preview an import" (D2209, D2210): reads the analyzed file again, pinned to its ETag (a file re-put since is
 * `job-state`), maps its columns (the merchant's override wins, D2210), validates and plans every row against the
 * active store (SKUs looked up 200 at a time, `id:<n>` keys, brands and tags; update rows need
 * `catalog.products.edit`, D2207), and stores the rows with the mapping and its hash. Reading the stored preview is
 * paginated, at most 200 rows a page.
 */
export class PreviewImportService {
  private readonly now: () => Date;

  constructor(private readonly deps: PreviewImportDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Computes and stores the preview of the import `importId`, answering its first page. */
  async preview(
    ctx: OperationContext,
    scope: StoreScope,
    request: { readonly importId: string; readonly canEdit: boolean; readonly overrides?: readonly ColumnOverride[] },
  ): Promise<ImportPreviewView> {
    const job = await importOf(this.deps.jobs, ctx, scope, request.importId);
    if (!PREVIEWABLE.has(job.status) || job.etag === null || job.headerRow === null) throw new JobStateError();
    const sheet = await readSource(this.deps, scope, { job, etag: job.etag });
    const mapping = this.mappingOf(job, headerCellsOf(sheet.rows, job.headerRow), request.overrides);
    const validated = dataRowsOf(sheet.rows, job.headerRow).map((row) => validateRow(rawRowOf(row, mapping)));
    const planned = planRows(
      validated,
      await this.lookupsOf(ctx, scope, { rows: validated, canEdit: request.canEdit }),
    );
    const summary = summaryOf(planned);
    const previewed = { mapping, mappingHash: mappingHashOf(mapping), preview: summary, at: this.now() };
    await this.deps.units.run(ctx, scope, async (tx) => {
      // The move first: it locks the job row, so a confirm waits for these rows, and a job a confirm moved while the
      // file was read keeps the rows it was confirmed with (D2265).
      if (!(await this.deps.jobs.markPreviewed(tx, scope, job.id, previewed))) throw new JobStateError();
      await this.deps.rows.replace(tx, scope, job.id, planned);
    });
    return this.pageOf(ctx, scope, {
      job: { ...job, preview: summary },
      query: { skip: 0, take: IMPORT_PREVIEW_PAGE_MAX },
    });
  }

  /** A page of the stored preview of the import `importId`; an import not previewed yet is `job-state`. */
  async page(
    ctx: OperationContext,
    scope: StoreScope,
    importId: string,
    query: ImportPreviewQuery,
  ): Promise<ImportPreviewView> {
    const job = await importOf(this.deps.jobs, ctx, scope, importId);
    if (!HAS_PREVIEW.has(job.status)) throw new JobStateError();
    return this.pageOf(ctx, scope, { job, query });
  }

  private async pageOf(
    ctx: OperationContext,
    scope: StoreScope,
    read: { readonly job: ImportJobRecord; readonly query: ImportPreviewQuery },
  ): Promise<ImportPreviewView> {
    const { job, query } = read;
    const page = await this.deps.rows.page(ctx, scope, job.id, query);
    return {
      importId: job.id,
      totalItems: page.total,
      skip: query.skip,
      take: query.take,
      items: page.rows.map(previewRowViewOf),
      summary: job.preview,
    };
  }

  /** The stored mapping, or the merchant's override of it; a mapping without a name and a price is `no-header`. */
  private mappingOf(job: ImportJobRecord, header: readonly string[], overrides?: readonly ColumnOverride[]): ColumnMap {
    const mapping = overrides === undefined && job.mapping !== null ? job.mapping : mapColumns(header, overrides);
    if (!hasRequiredFields(mapping)) throw new NoHeaderError();
    return mapping;
  }

  private async lookupsOf(
    ctx: OperationContext,
    scope: StoreScope,
    request: { readonly rows: readonly ValidatedRow[]; readonly canEdit: boolean },
  ): Promise<PlanLookups> {
    const skus = new Map<string, SkuLookup>();
    for (const batch of chunksOf(skusToLookUp(request.rows), IMPORT_SKU_LOOKUP_BATCH)) {
      for (const [sku, match] of await this.deps.catalog.findBySkus(ctx, scope, batch)) skus.set(sku, match);
    }
    const productIds = new Set<string>();
    for (const id of productIdsToLookUp(request.rows)) {
      if ((await this.deps.catalog.product(ctx, scope, id)) !== undefined) productIds.add(id);
    }
    const taxonomy = await this.deps.catalog.taxonomyIndex(ctx, scope);
    const byName = (refs: readonly { id: string; name: string }[]) =>
      new Map(refs.map((ref) => [taxonomyKey(ref.name), ref.id] as const));
    return {
      skus,
      productIds,
      brands: byName(taxonomy.brands),
      tags: byName(taxonomy.tags),
      canUpdate: request.canEdit,
    };
  }
}
