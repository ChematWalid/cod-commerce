import {
  CATALOG_IMPORT_ROW_ERRORS,
  type CatalogImportRowError,
  IMPORT_MAX_IMAGE_URLS,
  type ProductStatus,
} from '@cod/shared';
import { parseProductKey } from './list-cell';
import { skuKey } from './row-groups';
import type { PlannedRow } from './row-plan';

const E = CATALOG_IMPORT_ROW_ERRORS;
/** A product an import creates without a status cell starts as a draft, to be reviewed before it sells (D2262). */
const DEFAULT_CREATE_STATUS: ProductStatus = 'draft';

/** One variant's own values of a new product, found by its option values (D2219). */
export interface ImportVariantValues {
  readonly optionValues: readonly string[];
  readonly sku?: string;
  readonly price?: number;
  readonly oldPrice?: number;
  readonly barcode?: string;
}

/** A product an import creates: its fields and option groups, then its variants' own values (D2219). */
export interface ImportCreate {
  readonly product: {
    readonly title: string;
    readonly description?: string;
    readonly status: ProductStatus;
    readonly price: number;
    readonly oldPrice?: number;
    readonly sku?: string;
    readonly barcode?: string;
    readonly weight?: number;
    readonly brandId?: string;
    readonly tagIds: readonly string[];
    readonly optionGroups: readonly { readonly name: string; readonly values: readonly string[] }[];
  };
  readonly variants: readonly ImportVariantValues[];
}

/** A change to one live variant. */
export interface ImportVariantChange {
  readonly id: string;
  readonly sku?: string;
  readonly price?: number;
  readonly oldPrice?: number;
  readonly barcode?: string;
}

/** What an import changes on a product: only the fields its rows carry (an empty cell leaves the value, D2262). */
export interface ImportUpdate {
  readonly title?: string;
  readonly description?: string;
  readonly status?: ProductStatus;
  readonly weight?: number;
  readonly price?: number;
  readonly brandId?: string;
  readonly tagIds?: readonly string[];
  readonly variants: readonly ImportVariantChange[];
}

/** A live variant of a product an import updates. */
export interface ImportTargetVariant {
  readonly id: string;
  readonly sku: string;
  readonly optionValues: readonly string[];
}

/** A product an import updates, as it is when the worker applies the rows. */
export interface ImportTargetProduct {
  readonly id: string;
  readonly hasOptions: boolean;
  /** A pack is never a row's target (D2284): its computed values belong to catalog-packs. */
  readonly isPack: boolean;
  readonly variants: readonly ImportTargetVariant[];
}

/** The rows of one product group: never empty (D2210). */
export type GroupRows = readonly [PlannedRow, ...PlannedRow[]];

/** The product fields of a new product, as {@link ImportCreate} holds them beside its option groups. */
type CreateFields = Omit<ImportCreate['product'], 'optionGroups'>;
/** The product's own SKU and barcode a create takes. */
type OwnValues = Pick<ImportCreate['product'], 'sku' | 'barcode'>;
/** The variant changes of an update group and the rows it could not place. */
interface PlacedVariants {
  readonly variants: readonly ImportVariantChange[];
  readonly refused: ReadonlyMap<number, CatalogImportRowError>;
}

/** An update and the rows it could not place, each with its reason. */
export interface PlacedUpdate {
  readonly update: ImportUpdate;
  readonly refused: ReadonlyMap<number, CatalogImportRowError>;
}

const entry = <Key extends string, Value>(key: Key, value: Value | undefined): Partial<Record<Key, Value>> =>
  value === undefined ? {} : ({ [key]: value } as Record<Key, Value>);

/** The product SKU a group's key names, if it is a SKU (not an `id:<n>` or a row's own group). */
function productSkuOf(row: PlannedRow): string | undefined {
  const cell = row.values.productKey;
  if (cell === undefined) return undefined;
  const key = parseProductKey(cell);
  return key.kind === 'sku' ? key.sku : undefined;
}

/** Each option group of the rows with its distinct values, in first-seen order. */
function optionGroupsOf(rows: readonly PlannedRow[]): ImportCreate['product']['optionGroups'] {
  const first = rows[0]?.values.options ?? [];
  return first.map((option, slot) => {
    const values = new Map<string, string>();
    for (const row of rows) {
      const value = row.values.options[slot]?.value;
      if (value !== undefined && !values.has(skuKey(value))) values.set(skuKey(value), value);
    }
    return { name: option.name, values: [...values.values()] };
  });
}

const variantValuesOf = (row: PlannedRow): ImportVariantValues => ({
  optionValues: row.values.options.map(({ value }) => value),
  ...entry('sku', row.values.variantSku),
  ...entry('price', row.values.price),
  ...entry('oldPrice', row.values.oldPrice),
  ...entry('barcode', row.values.barcode),
});

/**
 * The product a create group makes (D2209, D2219): the first row's product fields (name, description, status, draft
 * when absent, brand, tags, weight of the first row holding one), the product key as the product SKU; with options,
 * the option groups of every row and each row's own variant values; without, the row's SKU, price and barcode.
 */
export function createOf(rows: GroupRows): ImportCreate {
  const [first] = rows;
  const optionGroups = optionGroupsOf(rows);
  const hasOptions = optionGroups.length > 0;
  return {
    product: { ...productFieldsOf(first, rows), ...ownValuesOf(first, hasOptions), optionGroups },
    variants: hasOptions ? rows.map(variantValuesOf) : [],
  };
}

/** The product fields a create group takes from its first row (the weight from the first row holding one). */
function productFieldsOf(first: PlannedRow, rows: readonly PlannedRow[]): Omit<CreateFields, keyof OwnValues> {
  const { values } = first;
  return {
    title: values.name ?? '',
    ...entry('description', values.description),
    status: values.status ?? DEFAULT_CREATE_STATUS,
    price: values.price ?? 0,
    ...entry('oldPrice', values.oldPrice),
    ...entry('weight', rows.find((row) => row.values.weight !== undefined)?.values.weight),
    ...entry('brandId', first.brandId),
    tagIds: first.tagIds ?? [],
  };
}

/** The product's own SKU and barcode: the key's SKU; without options, the one variant's SKU and barcode. */
function ownValuesOf(first: PlannedRow, hasOptions: boolean): OwnValues {
  if (hasOptions) return entry('sku', productSkuOf(first));
  return {
    ...entry('sku', productSkuOf(first) ?? first.values.variantSku),
    ...entry('barcode', first.values.barcode),
  };
}

/** Every SKU a create gives the store: the product's own and its variants', each once. */
export function skusOfCreate(command: ImportCreate): string[] {
  const variantSkus = command.variants.flatMap((variant) => (variant.sku === undefined ? [] : [variant.sku]));
  return [...new Set([...(command.product.sku === undefined ? [] : [command.product.sku]), ...variantSkus])];
}

const sameValues = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => skuKey(value) === skuKey(right[index] ?? ''));

/** The live variant a row updates: the one its SKU named, else the one with its option values, else the only one. */
function variantOf(row: PlannedRow, target: ImportTargetProduct): ImportTargetVariant | undefined {
  const bySku = target.variants.find((variant) => variant.id === row.variantId);
  if (bySku !== undefined) return bySku;
  const options = row.values.options.map(({ value }) => value);
  if (options.length > 0) return target.variants.find((variant) => sameValues(variant.optionValues, options));
  return target.variants.length === 1 ? target.variants[0] : undefined;
}

const variantChangeOf = (row: PlannedRow, variant: ImportTargetVariant): ImportVariantChange => ({
  id: variant.id,
  ...entry(
    'sku',
    row.values.variantSku === undefined || row.values.variantSku === variant.sku ? undefined : row.values.variantSku,
  ),
  ...entry('price', row.values.price),
  ...entry('oldPrice', row.values.oldPrice),
  ...entry('barcode', row.values.barcode),
});

/** The variant changes of the rows; a row naming no live variant, or one an earlier row took, is refused. */
function placeVariants(rows: readonly PlannedRow[], target: ImportTargetProduct): PlacedVariants {
  const variants: ImportVariantChange[] = [];
  const refused = new Map<number, CatalogImportRowError>();
  const taken = new Set<string>();
  for (const row of rows) {
    const variant = variantOf(row, target);
    if (variant === undefined) refused.set(row.rowNumber, E.VARIANT_NOT_FOUND);
    else if (taken.has(variant.id)) refused.set(row.rowNumber, E.DUPLICATE_IN_FILE);
    else {
      taken.add(variant.id);
      variants.push(variantChangeOf(row, variant));
    }
  }
  return { variants, refused };
}

/**
 * The update an update group makes on `target` as it is now (D2209, D2210): each row's variant values on the variant it
 * names, re-resolved against the live variants (a row whose variant is gone is refused with `row-variant-not-found`),
 * and the product fields of the first row placed (name, description, status, brand, tags; the first weight of a placed
 * row; the price only for a product without options, whose one variant carries it). A refused row changes nothing.
 */
export function updateOf(rows: readonly PlannedRow[], target: ImportTargetProduct): PlacedUpdate {
  const { variants, refused } = placeVariants(rows, target);
  const placed = rows.filter((row) => !refused.has(row.rowNumber));
  const [first] = placed;
  if (first === undefined) return { update: { variants: [] }, refused };
  const { values } = first;
  return {
    update: {
      ...entry('title', values.name),
      ...entry('description', values.description),
      ...entry('status', values.status),
      ...entry('weight', placed.find((row) => row.values.weight !== undefined)?.values.weight),
      ...entry('price', target.hasOptions ? undefined : values.price),
      ...entry('brandId', first.brandId),
      ...entry('tagIds', first.tagIds),
      variants,
    },
    refused,
  };
}

/** The image links of a product's rows, each once, at most {@link IMPORT_MAX_IMAGE_URLS} (D2209). */
export function imageUrlsOf(rows: readonly PlannedRow[]): string[] {
  return [...new Set(rows.flatMap((row) => row.values.imageUrls))].slice(0, IMPORT_MAX_IMAGE_URLS);
}
