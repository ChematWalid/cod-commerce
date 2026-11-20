import type { ImportFieldKey } from '@cod/shared';
import { EXPORT_READ_BATCH } from '../domain/constants';
import {
  type ExportableProduct,
  exportColumnsFor,
  type ExportItem,
  type ExportRow,
  exportRowsOf,
  projectRow,
  type TaxonomyNameIndex,
  taxonomyNamesIndex,
  withTaxonomyNames,
} from '../domain/export-row';
import type { StoreScope } from '../domain/store-scope';
import type { CatalogExportReadsPort } from './ports/catalog-export-reads.port';
import type { OperationContext } from './ports/operation-context';
import type { ProductOriginReads } from './ports/product-origin.port';
import type { SpreadsheetFormatAdapter } from './ports/spreadsheet-format.port';
import type { SpreadsheetFormatRegistry } from './spreadsheet-format.registry';

/** What one export file is made of: the products in order, the columns and the format. */
export interface ExportFileRequest {
  readonly productIds: readonly string[];
  readonly fields: readonly ImportFieldKey[];
  readonly format: string;
  /** Most rows (one per variant) the file may hold; past it no file is written (D2259). */
  readonly maxRows: number;
  /** Called after each batch with the number of products read so far. */
  readonly onProgress?: (done: number) => Promise<void>;
}

/** A written export file and what it holds. */
export interface ExportFile {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly rowCount: number;
  readonly skippedPacks: number;
}

/** What {@link ExportFileBuilder} reads through. */
export interface ExportFileDeps {
  readonly reads: Pick<CatalogExportReadsPort, 'product' | 'taxonomyIndex'>;
  readonly origins: ProductOriginReads;
  readonly formats: Pick<SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>, 'get'>;
}

const isProduct = (product: ExportableProduct | undefined): product is ExportableProduct => product !== undefined;

/**
 * Builds an export file (D2209, D2211): reads the products of the scope's store in batches, names their brand and
 * tags, adds their origin's image links, writes one row per variant in the asked columns (plus `variant_sku` and the
 * option pairs when a product has variants, D2260) with the format's writer.
 * An id of no product of the store (another store's, deleted) writes nothing; packs are skipped and counted (D2220).
 * Reading stops as soon as the rows pass `maxRows`, so memory stays bounded by the cap, not by the variants (D2259).
 */
export class ExportFileBuilder {
  constructor(private readonly deps: ExportFileDeps) {}

  /**
   * The file of `request.productIds` in the scope's store, or `undefined` when it would pass `request.maxRows` rows.
   * @throws FileTypeError for a format nobody registered
   */
  async build(ctx: OperationContext, scope: StoreScope, request: ExportFileRequest): Promise<ExportFile | undefined> {
    const adapter = this.deps.formats.get(request.format);
    const taxonomy = taxonomyNamesIndex(await this.deps.reads.taxonomyIndex(ctx, scope));
    const rows: ExportRow[] = [];
    let columns: readonly ImportFieldKey[] = request.fields;
    let skippedPacks = 0;
    const ids = request.productIds;
    for (let start = 0; start < ids.length; start += EXPORT_READ_BATCH) {
      const end = Math.min(start + EXPORT_READ_BATCH, ids.length);
      const items = await this.itemsOf(ctx, scope, { ids: ids.slice(start, end), taxonomy });
      const batch = exportRowsOf(items);
      if (rows.length + batch.rows.length > request.maxRows) return undefined;
      rows.push(...batch.rows);
      columns = exportColumnsFor(
        columns,
        items.map((item) => item.product),
      );
      skippedPacks += batch.skippedPacks;
      await request.onProgress?.(end);
    }
    const bytes = await adapter.writer.write(
      columns,
      rows.map((row) => projectRow(row, columns)),
    );
    return { bytes, contentType: adapter.contentType, rowCount: rows.length, skippedPacks };
  }

  /** The products of `ids` that the store has, named, with their origin. */
  private async itemsOf(
    ctx: OperationContext,
    scope: StoreScope,
    batch: { readonly ids: readonly string[]; readonly taxonomy: TaxonomyNameIndex },
  ): Promise<ExportItem[]> {
    const read = await Promise.all(batch.ids.map((id) => this.deps.reads.product(ctx, scope, id)));
    const products = read.filter(isProduct);
    const origins = await this.deps.origins.originsOf(
      ctx,
      scope,
      products.map((product) => product.id),
    );
    return products.map((product) => {
      const origin = origins.get(product.id);
      const named = withTaxonomyNames(product, batch.taxonomy);
      return origin === undefined ? { product: named } : { product: named, origin };
    });
  }
}
