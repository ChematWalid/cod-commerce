import type { OperationContext } from './operation-context';

/**
 * Serialises the saves and recomputes of one pack product (D2241): held until the transaction of `ctx` ends, so a
 * second save or recompute of the same pack waits, then reads the first one's committed pack row and product.
 */
export interface PackLockPort {
  /** Waits for, then holds, the lock of pack product `productId`; call it inside the transaction it guards. */
  acquire(ctx: OperationContext, productId: string): Promise<void>;
}
