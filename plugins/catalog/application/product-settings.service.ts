import type { Snowflake } from '@cod/shared';
import type { CoreId } from '../domain/core-id';
import { assertOrderManagers } from '../domain/order-managers';
import type { OperationContext } from '../domain/ports/operation-context';
import { type ProductSettingsChange, settingsAfter } from '../domain/product-settings';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';

/** The product a save writes links and settings for, in its store; the caller already found it there (D2135). */
export interface ProductTarget {
  readonly scope: StoreScope;
  readonly productId: CoreId;
}

/**
 * Checks the order managers a save sends with team's registered check, for the product's own store (D2114): with no
 * check registered only an empty list passes; with one, every id must be a member it accepts for that store.
 *
 * @throws {OrderManagersUnavailableError} when ids are sent and no check is registered.
 * @throws {OrderManagerUnknownError} when the check does not accept one of them.
 */
export async function checkOrderManagers(
  ports: ProductPorts,
  ctx: OperationContext,
  scope: StoreScope,
  ids: readonly Snowflake[],
): Promise<void> {
  const check = ids.length === 0 ? undefined : ports.orderManagers.current();
  if (check === undefined) {
    assertOrderManagers(ids, null);
    return;
  }
  const unknown = new Set<string>(await check.unknownIds(ctx, scope.businessId, scope.storeId, ids));
  assertOrderManagers(ids, new Set(ids.filter((id) => !unknown.has(id))));
}

/**
 * "Save a product's settings" (AC5) inside the product's save: writes them when sent, or the defaults when the product
 * has none yet. A change keeps every field it does not name. Its order managers were checked with the other ids the
 * save names, before anything was written ({@link ProductReferenceCheck}).
 */
export async function saveProductSettings(
  ports: ProductPorts,
  ctx: OperationContext,
  { scope, productId }: ProductTarget,
  change: ProductSettingsChange | undefined,
): Promise<void> {
  const current = await ports.settings.findByProduct(ctx, scope, productId);
  if (change === undefined && current !== undefined) return;
  const identity = { id: ports.ids.next(), scope, productId, now: ports.clock.now() };
  await ports.settings.upsert(ctx, scope, settingsAfter(current, change ?? {}, identity));
}
