import type { OfferTarget } from '@cod/shared';
import { UnknownOfferTargetsError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { OfferTargetCatalog } from '../domain/ports/target-catalog.port';
import type { StoreScope } from '../domain/store-scope';
import { catalogRefsOf, holdsEvery } from '../domain/target-refs';

/**
 * Refuses `targets` unless each variant, product and collection target is a row of `scope`'s store (D2537, D2342), so
 * an offer never names another store's or business's row, nor a deleted or unknown one. Collections are checked
 * through the registered membership source (unchecked while none is registered). No read when nothing is named.
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
  if (Object.values(wanted).every((ids: readonly string[]) => ids.length === 0)) return;
  const found = await catalog.existing(ctx, scope, wanted);
  if (!holdsEvery(wanted, found)) throw new UnknownOfferTargetsError();
}
