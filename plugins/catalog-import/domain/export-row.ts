import {
  IMPORT_LIST_SEPARATOR,
  type ImportFieldKey,
  MAX_OPTION_GROUPS,
  type ProductStatus,
  type ProductType,
} from '@cod/shared';

/** One variant as an export reads it. */
export interface ExportVariant {
  readonly sku: string;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly barcode: string | null;
  /** Its option values in the product's group order. */
  readonly optionValues: readonly string[];
}

/** A product as an export reads it from the catalog (catalog's product view has this shape). */
export interface ExportableProduct {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: ProductStatus;
  readonly type: ProductType;
  readonly sku: string | null;
  readonly weight: number | null;
  readonly brandId: string | null;
  readonly tagIds: readonly string[];
  readonly optionGroups: readonly { readonly name: string }[];
  readonly variants: readonly ExportVariant[];
}

/** A product with its brand and tag names, as the file writes them. */
export interface NamedExportProduct extends ExportableProduct {
  readonly brandName: string | null;
  readonly tagNames: readonly string[];
}

/** What the product's origin row adds to an export: the image links an import or a link import stored (D2209). */
export interface OriginView {
  readonly imageUrls: readonly string[];
}

/** A brand or tag of the store by id and name. */
export interface NamedId {
  readonly id: string;
  readonly name: string;
}

/** The store's brands and tags, to name a product's ids. */
export interface TaxonomyNames {
  readonly brands: readonly NamedId[];
  readonly tags: readonly NamedId[];
}

/** One cell of an export: text, a whole number, or empty. */
export type ExportCell = string | number | null;

/** One row of the product spreadsheet: one variant, every column key of D2209. */
export type ExportRow = Readonly<Record<ImportFieldKey, ExportCell>>;

/** The product type an export leaves out (D2220): the import refuses it in v1. */
const PACK_TYPE: ProductType = 'pack';
const ID_KEY_PREFIX = 'id:';

/**
 * The update key of a product (D2209): its SKU, or `id:<productId>` when it has none, so a SKU-less product
 * re-imports as an update in the same store.
 */
export function productKeyOf(product: Pick<ExportableProduct, 'id' | 'sku'>): string {
  const sku = product.sku?.trim() ?? '';
  return sku === '' ? `${ID_KEY_PREFIX}${product.id}` : sku;
}

/** The store's brand and tag names by id, built once per export. */
export interface TaxonomyNameIndex {
  readonly brands: ReadonlyMap<string, string>;
  readonly tags: ReadonlyMap<string, string>;
}

/** The id → name maps of the store's brands and tags. */
export function taxonomyNamesIndex(taxonomy: TaxonomyNames): TaxonomyNameIndex {
  return {
    brands: new Map(taxonomy.brands.map((brand) => [brand.id, brand.name])),
    tags: new Map(taxonomy.tags.map((tag) => [tag.id, tag.name])),
  };
}

/** The product with the names of its brand and tags; an id the store no longer has is left out. */
export function withTaxonomyNames(product: ExportableProduct, index: TaxonomyNameIndex): NamedExportProduct {
  return {
    ...product,
    brandName: product.brandId === null ? null : (index.brands.get(product.brandId) ?? null),
    tagNames: product.tagIds.flatMap((id) => {
      const name = index.tags.get(id);
      return name === undefined ? [] : [name];
    }),
  };
}

const listCell = (values: readonly string[]): string | null =>
  values.length === 0 ? null : values.join(IMPORT_LIST_SEPARATOR);

/** The `option<n>_name` / `option<n>_value` cells of one variant, for every option slot of the file. */
function optionCells(product: ExportableProduct, variant: ExportVariant): Record<string, ExportCell> {
  const cells: Record<string, ExportCell> = {};
  for (let slot = 1; slot <= MAX_OPTION_GROUPS; slot += 1) {
    cells[`option${String(slot)}_name`] = product.optionGroups[slot - 1]?.name ?? null;
    cells[`option${String(slot)}_value`] = variant.optionValues[slot - 1] ?? null;
  }
  return cells;
}

/** The cells every row of the product repeats. */
function productCells(product: NamedExportProduct, origin: OriginView | undefined): Record<string, ExportCell> {
  return {
    product_key: productKeyOf(product),
    name: product.title,
    description: product.description,
    status: product.status,
    type: product.type,
    weight: product.weight,
    brand: product.brandName,
    tags: listCell(product.tagNames),
    // Collections are ignored by the import until P2.S3 (D2209): the column stays empty.
    collections: null,
    image_urls: listCell(origin?.imageUrls ?? []),
  };
}

/**
 * The spreadsheet rows of one product (D2209): one per variant, prices in whole DZD as stored (never scaled), the
 * option name and value pairs in group order. A pack product yields no row (D2220).
 */
export function toExportRows(product: NamedExportProduct, origin?: OriginView): ExportRow[] {
  if (product.type === PACK_TYPE) return [];
  const shared = productCells(product, origin);
  return product.variants.map(
    (variant) =>
      ({
        ...shared,
        price: variant.price,
        old_price: variant.oldPrice,
        ...optionCells(product, variant),
        variant_sku: variant.sku === '' ? null : variant.sku,
        barcode: variant.barcode,
      }) as ExportRow,
  );
}

/** One product of an export with its origin, if it has one. */
export interface ExportItem {
  readonly product: NamedExportProduct;
  readonly origin?: OriginView;
}

/** The rows of a batch of products and how many packs it left out (D2220). */
export interface ExportBatch {
  readonly rows: readonly ExportRow[];
  readonly skippedPacks: number;
}

/** The rows of `items` in order; each pack product counts as skipped. */
export function exportRowsOf(items: readonly ExportItem[]): ExportBatch {
  const rows = items.flatMap((item) => toExportRows(item.product, item.origin));
  const skippedPacks = items.filter((item) => item.product.type === PACK_TYPE).length;
  return { rows, skippedPacks };
}

/** The cells of `row` for the asked columns, in their order. */
export function projectRow(row: ExportRow, columns: readonly ImportFieldKey[]): ExportCell[] {
  return columns.map((column) => row[column]);
}
