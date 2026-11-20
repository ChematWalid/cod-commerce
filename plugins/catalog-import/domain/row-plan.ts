import {
  CATALOG_IMPORT_ROW_ERRORS,
  CATALOG_IMPORT_ROW_WARNINGS,
  type CatalogImportRowReason,
  type ImportRowAction,
} from '@cod/shared';
import type { ImportRowValues, ValidatedRow } from './import-row';
import { parseProductKey } from './list-cell';
import type { PlanLookups } from './plan-lookups';
import { type GroupTarget, groupRows, type RowGroup, skuKey, targetOfGroup } from './row-groups';

export type { PlanLookups, SkuLookup } from './plan-lookups';

const E = CATALOG_IMPORT_ROW_ERRORS;
const W = CATALOG_IMPORT_ROW_WARNINGS;

/**
 * One previewed row (D2210): what confirm does with it, the product group it belongs to (`productKey`; null for a row
 * without one, which is its own product), its reasons (message ids only), the product (and variant) an update targets, and the brand and
 * tag ids its names resolved to in the store.
 */
export interface PlannedRow {
  readonly rowNumber: number;
  readonly action: ImportRowAction;
  readonly productKey: string | null;
  readonly messages: readonly CatalogImportRowReason[];
  readonly values: ImportRowValues;
  readonly productId: string | null;
  readonly variantId: string | null;
  readonly brandId?: string;
  readonly tagIds?: readonly string[];
}

/** The text a brand or tag name is compared by: names are unique in a store whatever their case (D2140). */
export const taxonomyKey = (name: string): string => name.normalize('NFC').trim().toLowerCase();

/** The SKUs a plan needs looked up: product keys that are SKUs and variant SKUs, each once. */
export function skusToLookUp(rows: readonly ValidatedRow[]): string[] {
  const skus = new Set<string>();
  for (const { values } of rows) {
    const key = values.productKey === undefined ? undefined : parseProductKey(values.productKey);
    if (key?.kind === 'sku') skus.add(key.sku);
    if (values.variantSku !== undefined) skus.add(values.variantSku);
  }
  return [...skus];
}

/** The product ids `id:<n>` keys name, each once. */
export function productIdsToLookUp(rows: readonly ValidatedRow[]): string[] {
  const ids = new Set<string>();
  for (const { values } of rows) {
    const key = values.productKey === undefined ? undefined : parseProductKey(values.productKey);
    if (key?.kind === 'id') ids.add(key.productId);
  }
  return [...ids];
}

const errorRow = (
  row: ValidatedRow,
  productKey: string | null,
  reasons: readonly CatalogImportRowReason[],
): PlannedRow => ({
  rowNumber: row.rowNumber,
  action: 'error',
  productKey,
  messages: [...new Set(reasons)],
  values: row.values,
  productId: null,
  variantId: null,
});

/** A row's brand and tag ids, and a warning per name the store does not know. */
interface RowTaxonomy {
  readonly warnings: readonly CatalogImportRowReason[];
  readonly brandId: string | undefined;
  readonly tagIds: readonly string[] | undefined;
}

/** The brand and tag ids of a row's names; an unknown name warns and is left out (D2209). */
function taxonomyOf(values: ImportRowValues, lookups: PlanLookups): RowTaxonomy {
  const warnings: CatalogImportRowReason[] = [];
  const brandId = values.brand === undefined ? undefined : lookups.brands.get(taxonomyKey(values.brand));
  if (values.brand !== undefined && brandId === undefined) warnings.push(W.UNKNOWN_TAXONOMY);
  const known = values.tags?.flatMap((name) => {
    const id = lookups.tags.get(taxonomyKey(name));
    if (id === undefined) warnings.push(W.UNKNOWN_TAXONOMY);
    return id === undefined ? [] : [id];
  });
  // A tags cell of unknown names only is ignored, not read as "no tags" (D2209).
  const tagIds = known === undefined || known.length === 0 ? undefined : [...new Set(known)];
  return { warnings, brandId, tagIds };
}

/** The reasons a row of a resolved group cannot be applied, beyond its own validation errors. */
function refusalsOf(row: ValidatedRow, target: GroupTarget, lookups: PlanLookups): CatalogImportRowReason[] {
  if (target.kind === 'error') return [target.reason];
  const rowError = target.rowErrors.get(row.rowNumber);
  if (rowError !== undefined) return [rowError];
  if (target.kind === 'update' && !lookups.canUpdate) return [E.UPDATE_FORBIDDEN];
  if (target.kind === 'create' && row.values.price === undefined) return [E.INVALID_VALUE];
  return [];
}

function plannedOf(group: RowGroup, row: ValidatedRow, lookups: PlanLookups, target: GroupTarget): PlannedRow {
  const refusals = refusalsOf(row, target, lookups);
  if (refusals.length > 0 || target.kind === 'error') return errorRow(row, group.key, refusals);
  const { warnings, brandId, tagIds } = taxonomyOf(row.values, lookups);
  const weightWarning = group.weightConflicts.has(row.rowNumber) ? [W.WEIGHT_CONFLICT] : [];
  return {
    rowNumber: row.rowNumber,
    action: target.kind,
    productKey: group.key,
    messages: [...new Set([...weightWarning, ...warnings])],
    values: row.values,
    productId: target.kind === 'update' ? target.productId : null,
    variantId: target.kind === 'update' ? (target.variantIds.get(row.rowNumber) ?? null) : null,
    ...(brandId === undefined ? {} : { brandId }),
    ...(tagIds === undefined ? {} : { tagIds }),
  };
}

/** The group a row belongs to before grouping: its product key compared as SKUs are, or the row itself. */
const ownerOf = (row: ValidatedRow): string =>
  row.values.productKey === undefined ? ` ${String(row.rowNumber)}` : `=${skuKey(row.values.productKey)}`;

/** The SKU a row's product key names, when the key is a SKU (not an `id:<n>`). */
function keySkuOf(row: ValidatedRow): string | undefined {
  const key = row.values.productKey === undefined ? undefined : parseProductKey(row.values.productKey);
  return key?.kind === 'sku' ? skuKey(key.sku) : undefined;
}

/**
 * Rows that reuse a SKU of the file (Review Focus 3, D2268): a variant SKU an earlier row already used as a variant
 * SKU, or a variant SKU or SKU product key that an earlier row of another group used as either. A group's own key and
 * its own variant SKUs do not count against each other; both would become SKUs of the products the file creates.
 */
function duplicateSkuRows(rows: readonly ValidatedRow[]): ReadonlySet<number> {
  const owners = new Map<string, string>();
  const variantSkus = new Set<string>();
  const duplicates = new Set<number>();
  for (const row of rows) {
    const owner = ownerOf(row);
    const keySku = keySkuOf(row);
    const variantSku = row.values.variantSku === undefined ? undefined : skuKey(row.values.variantSku);
    const own = [keySku, variantSku].filter((sku): sku is string => sku !== undefined);
    const takenElsewhere = own.some((sku) => (owners.get(sku) ?? owner) !== owner);
    if (takenElsewhere || (variantSku !== undefined && variantSkus.has(variantSku))) {
      duplicates.add(row.rowNumber);
      continue;
    }
    for (const sku of own) owners.set(sku, owner);
    if (variantSku !== undefined) variantSkus.add(variantSku);
  }
  return duplicates;
}

/** Who updates each product of the file so far: a keyed group, or rows without a key (D2267, D2268). */
type Targeted = Map<string, 'keyed' | 'keyless'>;

/**
 * A group updating a product an earlier group of the file already updates is a duplicate in the file (D2267), except
 * rows without a key after other keyless rows of the same product: they name other variants of it by SKU (a repeated
 * SKU is already refused) and are written with them as one group (D2268).
 */
function onceEach(group: RowGroup, target: GroupTarget, targeted: Targeted): GroupTarget {
  if (target.kind !== 'update') return target;
  const by = group.key === null ? 'keyless' : 'keyed';
  const earlier = targeted.get(target.productId);
  if (earlier !== undefined && !(earlier === 'keyless' && by === 'keyless')) {
    return { kind: 'error', reason: E.DUPLICATE_IN_FILE };
  }
  targeted.set(target.productId, by);
  return target;
}

/**
 * Plans what confirm does with each row (D2209, D2210), in file order: rows are grouped by `product_key`; a group's
 * product key (`id:<n>` in the store, or a SKU naming one product) or else its variant SKUs pick the product it
 * updates; a group naming none creates one; a later group naming a product an earlier one updates is a duplicate
 * (D2267), except keyless rows naming other variants of a product other keyless rows update (D2268). A row is an error
 * with its reasons when it is invalid, reuses a SKU of another row (D2268) or repeats an option combination, names an ambiguous SKU or an `id:<n>` of no product of the store (one reason,
 * whatever the id's owner), names a variant SKU of another product, updates without edit permission, or creates
 * without a price. Unknown brand or tag names and a weight differing from the group's first warn.
 */
export function planRows(rows: readonly ValidatedRow[], lookups: PlanLookups): PlannedRow[] {
  const duplicates = duplicateSkuRows(rows);
  const planned = new Map<number, PlannedRow>();
  for (const row of rows) {
    const key = row.values.productKey ?? null;
    if (row.errors.length > 0) planned.set(row.rowNumber, errorRow(row, key, row.errors));
    else if (duplicates.has(row.rowNumber)) planned.set(row.rowNumber, errorRow(row, key, [E.DUPLICATE_IN_FILE]));
  }
  const targeted: Targeted = new Map();
  for (const group of groupRows(rows.filter((row) => !planned.has(row.rowNumber)))) {
    const target = onceEach(group, targetOfGroup(group, lookups), targeted);
    for (const row of group.rows) planned.set(row.rowNumber, plannedOf(group, row, lookups, target));
  }
  return rows.map((row) => planned.get(row.rowNumber) as PlannedRow);
}
