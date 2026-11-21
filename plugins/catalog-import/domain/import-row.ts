import type { CatalogImportRowError, ImportFieldKey, ProductStatus } from '@cod/shared';

/** One data row of the file: its number as the merchant sees it and its text by field (mapped columns only). */
export interface RawImportRow {
  readonly rowNumber: number;
  readonly cells: Readonly<Partial<Record<ImportFieldKey, string>>>;
}

/** One option of a row: its group name and this variant's value, such as Size / M. */
export interface ImportOption {
  readonly name: string;
  readonly value: string;
}

/**
 * The values of a row, parsed (D2209). An absent field was not mapped or its cell was empty: a create takes the
 * catalog's default, an update leaves the product's value as it is.
 */
export interface ImportRowValues {
  readonly productKey?: string;
  readonly name?: string;
  readonly description?: string;
  readonly status?: ProductStatus;
  /** Whole DZD, never scaled (ADR 0004). */
  readonly price?: number;
  readonly oldPrice?: number;
  /** Grams (D2125). */
  readonly weight?: number;
  readonly brand?: string;
  readonly tags?: readonly string[];
  readonly options: readonly ImportOption[];
  readonly variantSku?: string;
  readonly barcode?: string;
  readonly imageUrls: readonly string[];
}

/** A row after {@link validateRow}: its values and the reasons it cannot be applied (none: it can). */
export interface ValidatedRow {
  readonly rowNumber: number;
  readonly values: ImportRowValues;
  readonly errors: readonly CatalogImportRowError[];
}
