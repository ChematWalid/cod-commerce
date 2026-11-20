import type { OfferTarget } from '@cod/shared';
import { UnknownOfferTargetsError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { OfferTargetCatalog } from '../domain/ports/target-catalog.port';
import type { StoreScope } from '../domain/store-scope';
import { catalogRefsOf, holdsEvery } from '../domain/target-refs';

/**
 * Refuses `targets` unless each variant and product target is a row of `scope`'s store (D2537), so an offer never
 * names another store's or business's row, nor a deleted or unknown one. Collection targets are not checked until
 * P2.S3 brings a collection seam. No read when nothing is to be checked.
 *
 * @throws {@link UnknownOfferTargetsError} when one of them is not.
 */
export async function assertTargetsInStore(
  catalog: OfferTargetCatalog,
  ctx: OperationContext,
  scope: StoreScope,
  targets: readonly OfferTarget[],
): Promise<void> {
  const wanted = catalogRefsOf(targets);
  if (wanted.variantIds.length === 0 && wanted.productIds.length === 0) return;
  const found = await catalog.existing(ctx, scope, wanted);
  if (!holdsEvery(wanted, found)) throw new UnknownOfferTargetsError();
}
