import { CATALOG_IMPORT_ROW_ERRORS, type CatalogImportRowError } from '@cod/shared';
import type { ValidatedRow } from './import-row';
import { parseProductKey } from './list-cell';
import type { PlanLookups, SkuLookup } from './plan-lookups';

const E = CATALOG_IMPORT_ROW_ERRORS;
const NO_MATCH: SkuLookup = { kind: 'none' };

/** The rows of one product (D2209): one `product_key`, or a single row without one (`key` null). */
export interface RowGroup {
  readonly key: string | null;
  readonly rows: readonly ValidatedRow[];
  /** Rows whose weight differs from the group's first weight: the first row wins (D2209). */
  readonly weightConflicts: ReadonlySet<number>;
}

/** What a group does, and the reasons particular rows of it cannot be applied. */
export type GroupTarget =
  | { readonly kind: 'error'; readonly reason: CatalogImportRowError }
  | { readonly kind: 'create'; readonly rowErrors: ReadonlyMap<number, CatalogImportRowError> }
  | {
      readonly kind: 'update';
      readonly productId: string;
      readonly variantIds: ReadonlyMap<number, string>;
      readonly rowErrors: ReadonlyMap<number, CatalogImportRowError>;
    };

/** How SKUs and option values of one file are compared with each other: trimmed, NFC, case folded. */
export const skuKey = (value: string): string => value.normalize('NFC').trim().toLowerCase();

function weightConflictsOf(rows: readonly ValidatedRow[]): Set<number> {
  const first = rows.find((row) => row.values.weight !== undefined)?.values.weight;
  return new Set(
    rows.filter((row) => row.values.weight !== undefined && row.values.weight !== first).map((row) => row.rowNumber),
  );
}

/** The rows grouped by product key, in order of first appearance; a row without a key is its own group. */
export function groupRows(rows: readonly ValidatedRow[]): RowGroup[] {
  const byKey = new Map<string, ValidatedRow[]>();
  for (const row of rows) {
    // A trimmed cell never starts with a space, so a keyless row's own group cannot meet a real key.
    const key = row.values.productKey === undefined ? ` ${String(row.rowNumber)}` : `=${row.values.productKey}`;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return [...byKey.values()].map((grouped) => ({
    key: grouped[0]?.values.productKey ?? null,
    rows: grouped,
    weightConflicts: weightConflictsOf(grouped),
  }));
}

/** What a group's key names: a product of the store, a refusal of the whole group, or nothing. */
type KeyTarget =
  | { readonly kind: 'product'; readonly productId: string }
  | { readonly kind: 'refused'; readonly reason: CatalogImportRowError }
  | { readonly kind: 'none' };

const NONE: KeyTarget = { kind: 'none' };

/** The product the group's key names: an id of the store, a SKU naming one product, a refusal, or none. */
function productOfKey(group: RowGroup, lookups: PlanLookups): KeyTarget {
  const cell = group.rows[0]?.values.productKey;
  if (cell === undefined) return NONE;
  const key = parseProductKey(cell);
  if (key.kind === 'id') {
    return lookups.productIds.has(key.productId)
      ? { kind: 'product', productId: key.productId }
      : { kind: 'refused', reason: E.PRODUCT_NOT_FOUND };
  }
  const match = lookups.skus.get(key.sku) ?? NO_MATCH;
  if (match.kind === 'ambiguous') return { kind: 'refused', reason: E.AMBIGUOUS };
  return match.kind === 'one' ? { kind: 'product', productId: match.productId } : NONE;
}

const variantMatchOf = (row: ValidatedRow, lookups: PlanLookups): SkuLookup =>
  row.values.variantSku === undefined ? NO_MATCH : (lookups.skus.get(row.values.variantSku) ?? NO_MATCH);

/** The product the first row with a variant SKU of one product names, when the key names none. */
function productOfVariants(group: RowGroup, lookups: PlanLookups): string | undefined {
  for (const row of group.rows) {
    const match = variantMatchOf(row, lookups);
    if (match.kind === 'one') return match.productId;
  }
  return undefined;
}

const combinationOf = (row: ValidatedRow): string =>
  JSON.stringify(row.values.options.map(({ value }) => skuKey(value)));
const optionNamesOf = (row: ValidatedRow): string => JSON.stringify(row.values.options.map(({ name }) => skuKey(name)));

/** Rows repeating an option combination of the group, or naming other option groups than its first row. */
function matrixErrorsOf(group: RowGroup, errors: Map<number, CatalogImportRowError>): void {
  const names = group.rows[0] === undefined ? '' : optionNamesOf(group.rows[0]);
  const seen = new Set<string>();
  for (const row of group.rows) {
    const combination = combinationOf(row);
    if (errors.has(row.rowNumber)) continue;
    if (optionNamesOf(row) !== names) errors.set(row.rowNumber, E.INVALID_VALUE);
    else if (seen.has(combination)) errors.set(row.rowNumber, E.DUPLICATE_IN_FILE);
    seen.add(combination);
  }
}

/** Each row's variant of `productId` by its SKU; a SKU of another product, or of several, refuses the row. */
function variantsOf(group: RowGroup, productId: string | undefined, lookups: PlanLookups) {
  const variantIds = new Map<number, string>();
  const rowErrors = new Map<number, CatalogImportRowError>();
  for (const row of group.rows) {
    const match = variantMatchOf(row, lookups);
    if (match.kind === 'ambiguous') rowErrors.set(row.rowNumber, E.AMBIGUOUS);
    if (match.kind !== 'one') continue;
    if (match.productId !== productId) rowErrors.set(row.rowNumber, E.AMBIGUOUS);
    else if (match.variantId !== null) variantIds.set(row.rowNumber, match.variantId);
  }
  return { variantIds, rowErrors };
}

/**
 * What a group does (D2209): an update of the product its key names (or, without a resolved key, the product its
 * first known variant SKU names), else a create in the active store. A key naming no product of the store, or
 * several, refuses the whole group.
 */
export function targetOfGroup(group: RowGroup, lookups: PlanLookups): GroupTarget {
  const fromKey = productOfKey(group, lookups);
  if (fromKey.kind === 'refused') return { kind: 'error', reason: fromKey.reason };
  const productId = fromKey.kind === 'product' ? fromKey.productId : productOfVariants(group, lookups);
  const { variantIds, rowErrors } = variantsOf(group, productId, lookups);
  matrixErrorsOf(group, rowErrors);
  if (productId === undefined) return { kind: 'create', rowErrors };
  return { kind: 'update', productId, variantIds, rowErrors };
}
