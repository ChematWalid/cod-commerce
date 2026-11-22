import { type Snowflake, toBusinessId } from '@cod/shared';
import { StoreReferenceNotFoundError } from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import type {
  StoreReferenceCheck,
  StoreReferenceKind,
  StoreReferenceScope,
} from '../domain/ports/store-reference-check.port';
import type { Store, StorePatch } from '../domain/store';

/** What other plugins get: they may add the check of a kind they own, never read the others. */
export interface StoreReferenceCheckRegistrar {
  register(check: StoreReferenceCheck): void;
}

/** What the use cases read: the check of a kind, if a plugin registered one. */
export interface StoreReferenceChecks {
  checkOf(kind: StoreReferenceKind): StoreReferenceCheck | undefined;
}

/**
 * The reference checks other plugins registered on bootstrap, one per kind (D3111; precedent the lifecycle registrar
 * and catalog's order-manager check). Until a kind is registered, every id of that kind is refused.
 */
export class StoreReferenceRegistry implements StoreReferenceCheckRegistrar, StoreReferenceChecks {
  private readonly checks = new Map<StoreReferenceKind, StoreReferenceCheck>();

  register(check: StoreReferenceCheck): void {
    if (this.checks.has(check.kind)) throw new Error(`A store reference check is already registered for ${check.kind}`);
    this.checks.set(check.kind, check);
  }

  checkOf(kind: StoreReferenceKind): StoreReferenceCheck | undefined {
    return this.checks.get(kind);
  }
}

/**
 * Asserts that `id` names a record of `scope`'s store, through the check registered for `kind`.
 *
 * @throws {@link StoreReferenceNotFoundError} when no check is registered or it answers no.
 */
export async function assertReferenceOwned(
  checks: StoreReferenceChecks,
  ctx: OperationContext,
  scope: StoreReferenceScope,
  reference: { readonly kind: StoreReferenceKind; readonly id: Snowflake },
): Promise<void> {
  const check = checks.checkOf(reference.kind);
  if (check === undefined || !(await check.exists(ctx, scope, reference.id))) {
    throw new StoreReferenceNotFoundError();
  }
}

/** The reference ids `patch` sets to a new non-null value; a cleared or unchanged id needs no check. */
function changedReferences(
  store: Store,
  patch: StorePatch,
): { readonly kind: StoreReferenceKind; readonly id: Snowflake }[] {
  const wanted = [
    { kind: 'deliveryFeeGroup', id: patch.defaultDeliveryFeeGroupId, current: store.defaultDeliveryFeeGroupId },
    { kind: 'carrier', id: patch.defaultCarrierId, current: store.defaultCarrierId },
  ] as const;
  return wanted.flatMap(({ kind, id, current }) =>
    id === undefined || id === null || id === current ? [] : [{ kind, id }],
  );
}

/**
 * Asserts every reference `patch` changes belongs to `store` (#230, #153), one after another on the transaction's
 * one connection.
 *
 * @throws {@link StoreReferenceNotFoundError}
 */
export async function assertReferencesOwned(
  checks: StoreReferenceChecks,
  ctx: OperationContext,
  store: Store,
  patch: StorePatch,
): Promise<void> {
  const scope: StoreReferenceScope = { businessId: toBusinessId(store.businessId), storeId: store.id };
  for (const reference of changedReferences(store, patch)) {
    await assertReferenceOwned(checks, ctx, scope, reference);
  }
}
