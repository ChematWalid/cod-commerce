import type { CreateStoreCollectionInput, StoreCollectionDto, UpdateStoreCollectionInput } from '../dto';
import { type CollectionForm, createInputOf, isEmptyUpdate, productIdsToSet, updateInputOf } from './editor-form';

/** The writes a save may send, bound to the editor's store. */
export interface CollectionWrites {
  readonly create: (input: CreateStoreCollectionInput) => Promise<StoreCollectionDto>;
  readonly update: (collectionId: string, input: UpdateStoreCollectionInput) => Promise<StoreCollectionDto>;
  readonly setProducts: (collectionId: string, productIds: readonly string[]) => Promise<StoreCollectionDto>;
}

/** The collection the editor saves: null id and null saved form for one not created yet. */
export interface CollectionSaveBase {
  readonly collectionId: string | null;
  readonly saved: CollectionForm | null;
  /**
   * Whether the caller holds the edit key that setting the products needs (D2314). A create-only caller's save sends
   * the create alone, so it is never answered with a refused product list it cannot retry.
   */
  readonly canSetProducts: boolean;
}

/**
 * What a save wrote. A create whose product list was refused afterwards is answered, not thrown: the collection exists,
 * so the editor must go on from it and a retry only sets the products (never a second create).
 */
export type CollectionSaveAnswer =
  | { readonly kind: 'saved'; readonly collection: StoreCollectionDto }
  | { readonly kind: 'created-without-products'; readonly collection: StoreCollectionDto; readonly error: unknown };

/** A new collection, then its hand-ordered products when it is manual and has some. */
async function createWith(
  writes: CollectionWrites,
  form: CollectionForm,
  canSetProducts: boolean,
): Promise<CollectionSaveAnswer> {
  const created = await writes.create(createInputOf(form));
  const productIds = canSetProducts ? productIdsToSet(null, form) : null;
  if (productIds === null) return { kind: 'saved', collection: created };
  try {
    return { kind: 'saved', collection: await writes.setProducts(created.id, productIds) };
  } catch (error: unknown) {
    return { kind: 'created-without-products', collection: created, error };
  }
}

/**
 * The changed fields, then the products when their order changed. The update goes first: a switch to manual must be
 * stored before a manual list can be set. Null when nothing changed.
 */
async function updateWith(
  writes: CollectionWrites,
  base: { readonly collectionId: string; readonly saved: CollectionForm; readonly canSetProducts: boolean },
  form: CollectionForm,
): Promise<CollectionSaveAnswer | null> {
  const input = updateInputOf(base.saved, form);
  const productIds = base.canSetProducts ? productIdsToSet(base.saved, form) : null;
  if (isEmptyUpdate(input) && productIds === null) return null;
  const updated = isEmptyUpdate(input) ? null : await writes.update(base.collectionId, input);
  if (productIds === null) return updated === null ? null : { kind: 'saved', collection: updated };
  return { kind: 'saved', collection: await writes.setProducts(base.collectionId, productIds) };
}

/** Sends a valid form: a create for a collection not created yet, otherwise only what changed. Null: nothing changed. */
export function saveCollection(
  writes: CollectionWrites,
  base: CollectionSaveBase,
  form: CollectionForm,
): Promise<CollectionSaveAnswer | null> {
  const { collectionId, saved, canSetProducts } = base;
  if (collectionId === null || saved === null) return createWith(writes, form, canSetProducts);
  return updateWith(writes, { collectionId, saved, canSetProducts }, form);
}
