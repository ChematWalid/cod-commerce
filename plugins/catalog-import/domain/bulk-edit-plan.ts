import {
  type BulkEditChangedField,
  type BulkPriceChange,
  catalogRefIdKey,
  MAX_PRODUCT_TAGS,
  type ProductStatus,
} from '@cod/shared';
import { InvalidImportInputError, PriceOutOfRangeError } from './errors';
import { applyPriceChange } from './price-change';

/** What a bulk edit reads of one product: the fields it may change. */
export interface EditableProduct {
  readonly id: string;
  /** Shown on the product's line of the answer, so the merchant reads names rather than ids (#261). */
  readonly title: string;
  readonly status: ProductStatus;
  readonly brandId: string | null;
  readonly tagIds: readonly string[];
  readonly price: number;
  readonly variants: readonly { readonly id: string; readonly price: number }[];
}

/**
 * The changes of a bulk edit once brand and tag ids are the store's own spelling (D2213); `brandId: null` clears the
 * brand. Collections are refused before any plan is made.
 */
export interface BulkChanges {
  readonly status?: ProductStatus;
  readonly brandId?: string | null;
  readonly addTagIds?: readonly string[];
  readonly removeTagIds?: readonly string[];
  readonly price?: BulkPriceChange;
}

/** The product edit a plan writes: only the fields that change. */
export interface ProductEditPatch {
  readonly brandId?: string | null;
  readonly tagIds?: readonly string[];
  readonly price?: number;
  readonly variants?: readonly { readonly id: string; readonly price: number }[];
}

/** What one product's bulk edit writes: a status change, a patch, and the fields recorded as changed. */
export interface ProductEditPlan {
  readonly changedFields: readonly BulkEditChangedField[];
  readonly status: ProductStatus | undefined;
  readonly patch: ProductEditPatch | undefined;
}

/** The product's tags after the change (removals, then additions in order), or `undefined` when they stay. */
function tagsAfter(product: EditableProduct, changes: BulkChanges): readonly string[] | undefined {
  const added = changes.addTagIds ?? [];
  const removed = new Set(changes.removeTagIds ?? []);
  if (added.some((id) => removed.has(id))) throw new InvalidImportInputError();
  const kept = product.tagIds.filter((id) => !removed.has(id));
  const tags = [...kept, ...added.filter((id) => !kept.includes(id))];
  if (tags.length > MAX_PRODUCT_TAGS) throw new InvalidImportInputError();
  const same = tags.length === product.tagIds.length && tags.every((id) => product.tagIds.includes(id));
  return same ? undefined : tags;
}

/** The product and variant prices after the change, or `undefined` when none moves. */
function pricesAfter(product: EditableProduct, change: BulkPriceChange | undefined): ProductEditPatch | undefined {
  if (change === undefined) return undefined;
  const priced = (price: number): number => {
    const next = applyPriceChange(price, change);
    if (next === undefined) throw new PriceOutOfRangeError();
    return next;
  };
  const price = priced(product.price);
  const variants = product.variants.map((variant) => ({ id: variant.id, price: priced(variant.price) }));
  const moved =
    price !== product.price || variants.some((variant, index) => variant.price !== product.variants[index]?.price);
  return moved ? { price, variants } : undefined;
}

/**
 * Plans the bulk edit of one product (D2213): each field is written and recorded only when it changes, in the order
 * status, brand, tags, price. Prices change on the product and every variant.
 *
 * @throws {PriceOutOfRangeError} when a new price is below 0 or above the money maximum.
 * @throws {InvalidImportInputError} when a tag is both added and removed, or the product would hold too many tags.
 */
export function planProductEdit(product: EditableProduct, changes: BulkChanges): ProductEditPlan {
  const status = changes.status !== undefined && changes.status !== product.status ? changes.status : undefined;
  const brandId = changes.brandId !== undefined && changes.brandId !== product.brandId ? changes.brandId : undefined;
  const tagIds = tagsAfter(product, changes);
  const prices = pricesAfter(product, changes.price);
  const patch: ProductEditPatch = {
    ...(brandId === undefined ? {} : { brandId }),
    ...(tagIds === undefined ? {} : { tagIds }),
    ...prices,
  };
  return {
    changedFields: changedFieldsOf({ status, brandId, tagIds, prices }),
    status,
    patch: Object.keys(patch).length === 0 ? undefined : patch,
  };
}

/** The fields recorded as changed, in the order status, brand, tags, price; `undefined` means unchanged. */
function changedFieldsOf(
  changed: Readonly<Record<'status' | 'brandId' | 'tagIds' | 'prices', unknown>>,
): BulkEditChangedField[] {
  const fieldOf = { status: 'status', brandId: 'brand', tagIds: 'tags', prices: 'price' } as const;
  return (['status', 'brandId', 'tagIds', 'prices'] as const)
    .filter((key) => changed[key] !== undefined)
    .map((key) => fieldOf[key]);
}

/** The ids each once, as the boundary parses them (`"07"` is `"7"`), first spelling kept: a change applies once. */
export function distinctProductIds(ids: readonly string[]): string[] {
  const firstByKey = new Map<string, string>();
  for (const id of ids) if (!firstByKey.has(catalogRefIdKey(id))) firstByKey.set(catalogRefIdKey(id), id);
  return [...firstByKey.values()];
}
