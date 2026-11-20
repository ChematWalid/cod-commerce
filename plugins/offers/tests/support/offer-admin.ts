import type { OfferInput } from '@cod/shared';
import { OfferAdminService } from '../../application/offer-admin.service';
import { type OfferKindCalculator, OfferKindRegistry } from '../../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../../domain/kinds';
import type { OfferRecord } from '../../domain/offer-record';
import type { ActiveStorePort } from '../../domain/ports/active-store.port';
import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';
import { InMemoryOfferRepository, InMemoryOfferTables } from '../fakes/in-memory-offer-repository';
import { T0 } from './builders';
import { newId } from './offer-records';

/**
 * The in-memory offers whose next `update` first runs the queued write, so a test can land another write between a
 * read and its save, as a concurrent request would.
 */
class RacingOfferRepository extends InMemoryOfferRepository {
  queued: (() => Promise<unknown>) | undefined;

  override async update(
    ctx: OperationContext,
    scope: StoreScope,
    offer: OfferRecord,
    expectedVersion: number,
  ): Promise<boolean> {
    const run = this.queued;
    this.queued = undefined;
    if (run !== undefined) await run();
    return super.update(ctx, scope, offer, expectedVersion);
  }
}

/**
 * A caller already on the channel of whatever store it names: the tests of repository scoping use it, and the channel
 * guard (D2448) has its own tests over `FakeActiveStores`.
 */
export const EVERY_CHANNEL: ActiveStorePort = {
  activeStoreOf: () => Promise.resolve(undefined),
  isChannelOf: () => Promise.resolve(true),
  isOwnChannelOf: () => Promise.resolve(true),
};

/** What a test may swap in the admin service: the channel guard, and the calculators its kinds come from. */
export interface OfferAdminSetUp {
  readonly stores?: ActiveStorePort;
  readonly calculators?: readonly OfferKindCalculator<unknown>[];
}

/**
 * A service over empty in-memory tables whose clock reads `now()` of the returned setter; `race(write)` runs `write`
 * just before the service's next save. `stores` answers the channel guard (D2448); `calculators` default to the
 * built-in kinds.
 */
export function setUpOfferAdmin({ stores = EVERY_CHANNEL, calculators = BUILT_IN_OFFER_KINDS }: OfferAdminSetUp = {}) {
  const tables = new InMemoryOfferTables();
  const offers = new RacingOfferRepository(tables);
  let now = T0;
  const service = new OfferAdminService({
    offers,
    codes: tables.codes,
    ids: { next: newId },
    clock: { now: () => now },
    kinds: new OfferKindRegistry(calculators),
    stores,
  });
  const race = (write: () => Promise<unknown>) => (offers.queued = write);
  return { service, tables, race, setNow: (instant: Date) => (now = instant) };
}

/** A valid quantity offer input: 10 % off from two pieces of variant 11. */
export const QUANTITY_INPUT: OfferInput = {
  kind: 'quantity',
  title: '  Buy two  ',
  config: { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] },
  targets: [{ refType: 'variant', refId: '11' }],
};
