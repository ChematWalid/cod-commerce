import { FEATURE_KEYS, requireFeature } from '@cod/shared';
import type { OfferKindRegistry } from '../domain/engine/kind-registry';
import { type OfferMove, withMove } from '../domain/offer-lifecycle';
import { duplicateOf, type OfferRecord } from '../domain/offer-record';
import type { Clock } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import { assertPublishable } from '../domain/publish-check';
import type { StoreScope } from '../domain/store-scope';
import { loadOffer, type OfferAccessPorts, saveOffer } from './offer-access';

/** What the lifecycle use case reaches the outside through. */
export interface OfferLifecyclePorts extends OfferAccessPorts {
  readonly ids: IdGeneratorPort;
  readonly clock: Clock;
  readonly kinds: OfferKindRegistry;
}

/**
 * The status moves of an offer (D2510) and its duplicate (D2511). Going live (`publish`, `resume`) asks the plan gate
 * first (`requireFeature`, a no-op until P9.S1) and re-runs the publish checks, so an offer is only ever live while
 * complete. Every call is refused unless `ctx` is on `scope`'s store channel (D2448).
 */
export class OfferLifecycleService {
  constructor(private readonly ports: OfferLifecyclePorts) {}

  /**
   * Publishes a draft: the only way to `active` from `draft`, recording `publishedAt`.
   *
   * @throws {@link InvalidOfferTransitionError} when the offer is not a draft.
   * @throws {@link OfferPublishInvalidError} listing every missing part (title, targets, dates).
   * @throws {@link InvalidOfferConfigError} when its config no longer passes its kind's schema.
   */
  publish(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    return this.goLive(ctx, scope, rawId, 'publish');
  }

  /** Pauses an active offer; @throws {@link InvalidOfferTransitionError} for any other status. */
  pause(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    return this.move(ctx, scope, rawId, 'pause');
  }

  /**
   * Makes a paused offer active again once it passes the publish checks (an end date may have passed meanwhile).
   *
   * @throws {@link InvalidOfferTransitionError} when the offer is not paused.
   * @throws {@link OfferPublishInvalidError} listing every missing part.
   */
  resume(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    return this.goLive(ctx, scope, rawId, 'resume');
  }

  /** Archives an offer for good; @throws {@link InvalidOfferTransitionError} when it is archived already. */
  archive(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    return this.move(ctx, scope, rawId, 'archive');
  }

  /**
   * A new draft copying the offer, archived ones included, without its codes or usage (D2511).
   *
   * @throws {@link OfferNotFoundError} when the store has no such offer.
   */
  async duplicate(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    const source = await loadOffer(this.ports, ctx, scope, rawId);
    const copy = duplicateOf(source, this.ports.ids.next(), this.ports.clock.now());
    await this.ports.offers.create(ctx, scope, copy);
    return copy;
  }

  /** `move` applied and saved; @throws {@link OfferConflictError} when another write changed the offer meanwhile. */
  private async move(ctx: OperationContext, scope: StoreScope, rawId: string, move: OfferMove): Promise<OfferRecord> {
    const current = await loadOffer(this.ports, ctx, scope, rawId);
    const moved = withMove(current, move, this.ports.clock.now());
    await saveOffer(this.ports, ctx, scope, { offer: moved, readVersion: current.version });
    return moved;
  }

  /** A move into `active`: the plan gate, the move's own source check, then every publish check, then the save. */
  private async goLive(ctx: OperationContext, scope: StoreScope, rawId: string, move: OfferMove): Promise<OfferRecord> {
    const current = await loadOffer(this.ports, ctx, scope, rawId);
    await requireFeature(FEATURE_KEYS.ActiveOffers, scope);
    const now = this.ports.clock.now();
    const moved = withMove(current, move, now);
    assertPublishable(moved, this.ports.kinds, now);
    await saveOffer(this.ports, ctx, scope, { offer: moved, readVersion: current.version });
    return moved;
  }
}
