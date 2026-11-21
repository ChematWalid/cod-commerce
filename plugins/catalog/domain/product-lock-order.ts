import { type CoreId, parseCoreId } from './core-id';

/** How a product lock is held: exclusive by a write of the product, shared by a write that only read it. */
export type ProductLockMode = 'exclusive' | 'shared';

/** One product lock a write takes, in the order {@link packSaveLockSteps} lists them. */
export interface ProductLockStep {
  readonly productId: CoreId;
  readonly mode: ProductLockMode;
}

/** Compares two decimal ids by value. */
function byValue(left: CoreId, right: CoreId): number {
  const [first, second] = [BigInt(left), BigInt(right)];
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

/**
 * Ids in ascending numeric order, the one order every write takes several product locks in, so two such writes never
 * deadlock.
 */
export const inLockOrder = (ids: readonly CoreId[]): CoreId[] => [...ids].sort(byValue);

/**
 * The product locks a pack save holds (D2242): its pack product exclusively (the product it writes) and each component
 * shared, so no edit, status change or delete of a component commits between the save's read and its commit. All in
 * {@link inLockOrder}, like a bulk write. A malformed or repeated id is skipped; the pack product is never also a
 * shared step (the save refuses it as a component anyway).
 */
export function packSaveLockSteps(packProductId: CoreId, componentIds: readonly string[]): ProductLockStep[] {
  const components = new Set<CoreId>();
  for (const id of componentIds) {
    const parsed = parseCoreId(id);
    if (parsed !== undefined && parsed !== packProductId) components.add(parsed);
  }
  return inLockOrder([packProductId, ...components]).map((productId) => ({
    productId,
    mode: productId === packProductId ? 'exclusive' : 'shared',
  }));
}
