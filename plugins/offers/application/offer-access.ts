import { isSnowflake, type Snowflake } from '@cod/shared';
import { OfferConflictError, OfferNotFoundError } from '../domain/errors';
import type { OfferRecord } from '../domain/offer-record';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OfferRepositoryPort } from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { assertOnChannelOf } from './store-channel';

/** What reading and saving one offer of the store goes through. */
export interface OfferAccessPorts {
  readonly offers: OfferRepositoryPort;
  /** Checks every call's `ctx` is on `scope`'s store channel (D2448). */
  readonly stores: ActiveStorePort;
}

/** A request's offer id, or not-found for a malformed one: it must never reach Postgres as a bigint. */
export function offerIdOf(rawId: string): Snowflake {
  if (!isSnowflake(rawId)) throw new OfferNotFoundError();
  return rawId;
}

/**
 * The offer of the store, once `ctx` is proved on its channel.
 *
 * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s store channel (D2448).
 * @throws {@link OfferNotFoundError} for a foreign, unknown or malformed id.
 */
export async function loadOffer(
  ports: OfferAccessPorts,
  ctx: OperationContext,
  scope: StoreScope,
  rawId: string,
): Promise<OfferRecord> {
  await assertOnChannelOf(ports.stores, ctx, scope);
  const offer = await ports.offers.findById(ctx, scope, offerIdOf(rawId));
  if (offer === undefined) throw new OfferNotFoundError();
  return offer;
}

/** An offer to write, and the version it was read at (optimistic lock, D2440). */
export interface OfferWrite {
  readonly offer: OfferRecord;
  readonly readVersion: number;
}

/**
 * Writes the offer if it is still at its read version; otherwise not-found when it is gone, or a conflict, so a write
 * read before a concurrent one never undoes it (an archive stays final, D2440).
 */
export async function saveOffer(
  ports: OfferAccessPorts,
  ctx: OperationContext,
  scope: StoreScope,
  { offer, readVersion }: OfferWrite,
): Promise<void> {
  if (await ports.offers.update(ctx, scope, offer, readVersion)) return;
  const stillThere = await ports.offers.findById(ctx, scope, offer.id);
  throw stillThere === undefined ? new OfferNotFoundError() : new OfferConflictError();
}
