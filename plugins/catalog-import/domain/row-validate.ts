import {
  BARCODE_MAX,
  CATALOG_IMPORT_ROW_ERRORS,
  type CatalogImportRowError,
  DESCRIPTION_MAX,
  type ImportFieldKey,
  INT_COLUMN_MAX,
  MAX_OPTION_GROUPS,
  MAX_PRODUCT_TAGS,
  MONEY_MAX_DZD,
  OPTION_NAME_MAX,
  OPTION_VALUE_MAX,
  PRODUCT_STATUSES,
  PRODUCT_TITLE_MAX,
  type ProductStatus,
  SKU_MAX,
  unguardCell,
} from '@cod/shared';
import { parseImageUrls } from './image-urls';
import type { ImportOption, ImportRowValues, RawImportRow, ValidatedRow } from './import-row';
import { splitListCell } from './list-cell';

const E = CATALOG_IMPORT_ROW_ERRORS;
/** The only product type a row may name in v1 (D2209): packs are refused. */
const PHYSICAL_TYPE = 'physical';
const PACK_TYPE = 'pack';
/** A whole number, as Excel writes it (`1500`) or as a number cell reads back (`1500.0`). */
const WHOLE_NUMBER = /^\d+(?:\.0+)?$/;
/** Characters a number cell may hold beyond its digits: a `.0` Excel adds to a whole number cell. */
const NUMBER_CELL_EXTRA_CHARS = 2;
/** Characters a product key may hold beyond a SKU: an `id:` prefix or the `\` escape (D2261). */
const PRODUCT_KEY_EXTRA_CHARS = 3;
/** Longest brand or tag name a row may carry; catalog's own limits refuse longer ones at write. */
const NAME_CELL_MAX = PRODUCT_TITLE_MAX;

/** Collects a row's values and refusals; each parser reads one cell. */
class RowReader {
  readonly errors = new Set<CatalogImportRowError>();

  constructor(private readonly cells: RawImportRow['cells']) {}

  /**
   * The cell's text without the export's formula guard (D2256), trimmed; undefined when empty, or when longer than
   * `max` (refused, and not kept, so an error row stores no oversized text, D2269).
   */
  text(field: ImportFieldKey, max: number): string | undefined {
    const raw = this.cells[field];
    if (raw === undefined) return undefined;
    const value = unguardCell(raw.trim()).trim();
    if (value === '') return undefined;
    if (value.length <= max) return value;
    this.errors.add(E.INVALID_VALUE);
    return undefined;
  }

  /** A whole number in `0..max`, or undefined when the cell is empty. */
  whole(field: ImportFieldKey, max: number): number | undefined {
    const value = this.text(field, max.toString().length + NUMBER_CELL_EXTRA_CHARS);
    if (value === undefined) return undefined;
    const parsed = WHOLE_NUMBER.test(value) ? Number.parseInt(value, 10) : Number.NaN;
    if (!Number.isSafeInteger(parsed) || parsed > max) {
      this.errors.add(E.INVALID_VALUE);
      return undefined;
    }
    return parsed;
  }

  status(): ProductStatus | undefined {
    const value = this.text('status', NAME_CELL_MAX)?.toLowerCase();
    if (value === undefined) return undefined;
    const status = PRODUCT_STATUSES.find((known) => known === value);
    if (status === undefined) this.errors.add(E.INVALID_VALUE);
    return status;
  }

  type(): void {
    const value = this.text('type', NAME_CELL_MAX)?.toLowerCase();
    if (value === undefined || value === PHYSICAL_TYPE) return;
    this.errors.add(value === PACK_TYPE ? E.TYPE_UNSUPPORTED : E.INVALID_VALUE);
  }

  list(field: ImportFieldKey, maxItems: number): readonly string[] | undefined {
    const value = this.text(field, Number.MAX_SAFE_INTEGER);
    if (value === undefined) return undefined;
    const items = splitListCell(value).map((item) => unguardCell(item));
    if (items.length <= maxItems && items.every((item) => item.length <= NAME_CELL_MAX)) return items;
    this.errors.add(E.INVALID_VALUE);
    return undefined;
  }

  imageUrls(): readonly string[] {
    const value = this.text('image_urls', Number.MAX_SAFE_INTEGER);
    if (value === undefined) return [];
    const verdict = parseImageUrls(value);
    if (verdict.ok) return verdict.urls;
    this.errors.add(E.IMAGE_URL);
    return [];
  }

  options(): readonly ImportOption[] {
    const options: ImportOption[] = [];
    for (let slot = 1; slot <= MAX_OPTION_GROUPS; slot += 1) {
      const name = this.text(`option${String(slot)}_name` as ImportFieldKey, OPTION_NAME_MAX);
      const value = this.text(`option${String(slot)}_value` as ImportFieldKey, OPTION_VALUE_MAX);
      if (name === undefined && value === undefined) continue;
      if (name === undefined || value === undefined) this.errors.add(E.INVALID_VALUE);
      else options.push({ name, value });
    }
    return options;
  }
}

/** The value of `key` as an entry, or no entry when absent, so stored rows hold no undefined. */
const entry = <Key extends string, Value>(key: Key, value: Value | undefined): Partial<Record<Key, Value>> =>
  value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);

function valuesOf(reader: RowReader): ImportRowValues {
  reader.type();
  return {
    ...entry('productKey', reader.text('product_key', SKU_MAX + PRODUCT_KEY_EXTRA_CHARS)),
    ...entry('name', reader.text('name', PRODUCT_TITLE_MAX)),
    ...entry('description', reader.text('description', DESCRIPTION_MAX)),
    ...entry('status', reader.status()),
    ...entry('price', reader.whole('price', MONEY_MAX_DZD)),
    ...entry('oldPrice', reader.whole('old_price', MONEY_MAX_DZD)),
    ...entry('weight', reader.whole('weight', INT_COLUMN_MAX)),
    ...entry('brand', reader.text('brand', NAME_CELL_MAX)),
    ...entry('tags', reader.list('tags', MAX_PRODUCT_TAGS)),
    options: reader.options(),
    ...entry('variantSku', reader.text('variant_sku', SKU_MAX)),
    ...entry('barcode', reader.text('barcode', BARCODE_MAX)),
    imageUrls: reader.imageUrls(),
  };
}

/**
 * Parses one row (D2209): text cells lose the export's formula guard (D2256) and are trimmed; prices and weight are
 * whole numbers (`0..` the money or column maximum, never scaled); `status` is active/hidden/draft in any case;
 * `type` may only be physical (a pack is `row-type-unsupported`); an option needs its name and value; `image_urls`
 * are checked by {@link parseImageUrls}. A row needs a name; a missing price is the plan's to judge (an update may
 * leave it).
 */
export function validateRow(row: RawImportRow): ValidatedRow {
  const reader = new RowReader(row.cells);
  const values = valuesOf(reader);
  if (values.name === undefined) reader.errors.add(E.INVALID_VALUE);
  return { rowNumber: row.rowNumber, values, errors: [...reader.errors] };
}
