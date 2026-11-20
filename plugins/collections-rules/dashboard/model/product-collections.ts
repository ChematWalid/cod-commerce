import type { StoreCollectionDto, StoreCollectionRefDto, StoreProductCollectionsDto } from '../dto';

/** What the product editor's block shows: the hand-picked collections, and those a rule adds (read-only). */
export interface ProductCollectionsView {
  readonly manualIds: readonly string[];
  readonly byRule: readonly StoreCollectionRefDto[];
}

export const productCollectionsViewOf = (answer: StoreProductCollectionsDto): ProductCollectionsView => ({
  manualIds: answer.manual.map(({ id }) => id),
  byRule: answer.automatic,
});

/**
 * The ids a save sends (`setStoreProductCollections`): manual collections only, since a rule decides the automatic
 * ones and the server refuses them (D2309).
 */
export function collectionIdsToSend(picked: readonly string[], answer: StoreProductCollectionsDto): readonly string[] {
  const byRule = new Set(answer.automatic.map(({ id }) => id));
  return picked.filter((id) => !byRule.has(id));
}

/**
 * The collections the block offers to pick: the store's manual ones, plus any manual collection of the product the
 * loaded list does not hold, so a save never drops it unseen.
 */
export function manualChoicesOf(
  collections: readonly StoreCollectionDto[],
  answer: StoreProductCollectionsDto,
): readonly StoreCollectionRefDto[] {
  const manual = collections.filter(({ mode }) => mode === 'manual').map(({ id, title }) => ({ id, title }));
  const listed = new Set(manual.map(({ id }) => id));
  return [...manual, ...answer.manual.filter(({ id }) => !listed.has(id))];
}

/** Whether two picks hold the same collections; the order of a product's collections means nothing. */
export const samePicks = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((id) => right.includes(id));
