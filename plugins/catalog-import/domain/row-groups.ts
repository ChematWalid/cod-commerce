import {
  CATALOG_IMPORT_ROW_ERRORS,
  type CatalogImportRowError,
  MAX_OPTION_GROUPS,
  MAX_OPTION_VALUES,
  MAX_VARIANTS,
} from '@cod/shared';
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

/** What the worker groups a stored row by: its fields as the preview planned them. */
export interface WriteGroupFields {
  readonly rowNumber: number;
  readonly productKey: string | null;
  readonly action: string;
  readonly productId: string | null;
}

/**
 * The write group of a planned row (D2210, D2268): its product key as stored (every row of a key group is stored
 * under the group's first cell); a row without a key updating a product shares one group with the other keyless rows
 * updating it (they name different variants of it by SKU), so one write carries them and the first one's product
 * fields win; any other keyless row is its own group. A key never starts with `#` or a space.
 */
export function writeGroupKeyOf(row: WriteGroupFields): string {
  if (row.productKey !== null) return `=${row.productKey}`;
  if (row.action === 'update' && row.productId !== null) return `#${row.productId}`;
  return ` ${String(row.rowNumber)}`;
}

function weightConflictsOf(rows: readonly ValidatedRow[]): Set<number> {
  const first = rows.find((row) => row.values.weight !== undefined)?.values.weight;
  return new Set(
    rows.filter((row) => row.values.weight !== undefined && row.values.weight !== first).map((row) => row.rowNumber),
  );
}

/**
 * The rows grouped by product key, compared as SKUs are (`skuKey`: `new1` and `NEW1` are one product, D2267), in order
 * of first appearance; a row without a key is its own group. A group is keyed by its first row's cell, which every
 * row of it is stored with, so the worker groups the rows alike.
 */
export function groupRows(rows: readonly ValidatedRow[]): RowGroup[] {
  const byKey = new Map<string, ValidatedRow[]>();
  for (const row of rows) {
    // A trimmed cell never starts with a space, so a keyless row's own group cannot meet a real key.
    const key = row.values.productKey === undefined ? ` ${String(row.rowNumber)}` : `=${skuKey(row.values.productKey)}`;
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

/** How many distinct values each option slot of the rows holds (compared as SKUs are). */
function valueCountsOf(rows: readonly ValidatedRow[]): number[] {
  const slots = rows[0]?.values.options.length ?? 0;
  return Array.from(
    { length: slots },
    (_, slot) => new Set(rows.map((row) => skuKey(row.values.options[slot]?.value ?? ''))).size,
  );
}

/**
 * Whether the rows name every combination of their option values, within the catalog's matrix caps (D2270). The
 * catalog creates the whole cartesian product of the option groups, so a missing combination would be created at the
 * first row's price without being in the file, and a matrix over the caps fails at confirm. The rows' combinations are
 * already distinct and their option names alike ({@link matrixErrorsOf}), so a count equal to the product is full.
 */
function isFullMatrix(rows: readonly ValidatedRow[]): boolean {
  const counts = valueCountsOf(rows);
  if (counts.length > MAX_OPTION_GROUPS || counts.some((count) => count > MAX_OPTION_VALUES)) return false;
  const combinations = counts.reduce((product, count) => product * count, 1);
  return combinations <= MAX_VARIANTS && combinations === rows.length;
}

/**
 * The refusals of a create group (D2270): a row without a price, then, unless the rows left name the full option
 * matrix, every row left (`row-invalid-value`), so confirm creates exactly the rows the preview shows.
 */
function createErrorsOf(group: RowGroup, errors: Map<number, CatalogImportRowError>): void {
  for (const row of group.rows) {
    if (!errors.has(row.rowNumber) && row.values.price === undefined) errors.set(row.rowNumber, E.INVALID_VALUE);
  }
  const placed = group.rows.filter((row) => !errors.has(row.rowNumber));
  if (isFullMatrix(placed)) return;
  for (const row of placed) errors.set(row.rowNumber, E.INVALID_VALUE);
}

/** The variants a group's rows name by SKU, and the rows refused for naming another product's or several. */
interface GroupVariants {
  readonly variantIds: ReadonlyMap<number, string>;
  readonly rowErrors: Map<number, CatalogImportRowError>;
}

/** Each row's variant of `productId` by its SKU; a SKU of another product, or of several, refuses the row. */
function variantsOf(group: RowGroup, productId: string | undefined, lookups: PlanLookups): GroupVariants {
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
 * several, refuses the whole group; a create whose rows do not name its full option matrix refuses them all (D2270).
 */
export function targetOfGroup(group: RowGroup, lookups: PlanLookups): GroupTarget {
  const fromKey = productOfKey(group, lookups);
  if (fromKey.kind === 'refused') return { kind: 'error', reason: fromKey.reason };
  const productId = fromKey.kind === 'product' ? fromKey.productId : productOfVariants(group, lookups);
  const { variantIds, rowErrors } = variantsOf(group, productId, lookups);
  matrixErrorsOf(group, rowErrors);
  if (productId === undefined) {
    createErrorsOf(group, rowErrors);
    return { kind: 'create', rowErrors };
  }
  return { kind: 'update', productId, variantIds, rowErrors };
}
