import {
  COLLECTION_MEMBERSHIP_REGISTRAR,
  type CollectionMembership,
  type CollectionMembershipRegistrar,
  type CoreId,
  type OperationContext as OffersOperationContext,
  type StoreScope as OffersStoreScope,
} from '@cod/plugin-offers';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { CollectionMembershipQueries } from '../application/collection-membership-queries.service';
import { asOperationContext } from '../domain/ports/operation-context';

/**
 * Which store collections each product of a cart belongs to, for the offers' collection targets (D2341): manual and
 * automatic members of the quoted store only (D2306), the same answer the merchant UI reads. Registered on the
 * offers' seam on bootstrap, so the offers never depend on this plugin. Membership lags product edits by the outbox
 * delay (seconds).
 */
@Injectable()
export class OffersCollectionMembershipSource implements CollectionMembership, OnApplicationBootstrap {
  constructor(
    private readonly queries: CollectionMembershipQueries,
    @Inject(COLLECTION_MEMBERSHIP_REGISTRAR) private readonly registrar: CollectionMembershipRegistrar,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  /** Keyed by canonical product id, which is the offers' {@link CoreId} form; a product of no collection is absent. */
  collectionsOf(
    ctx: OffersOperationContext,
    scope: OffersStoreScope,
    productIds: readonly CoreId[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    return this.queries.collectionIdsOfProducts(asOperationContext(ctx), scope, productIds);
  }

  /** The store's live collections among `collectionIds`, canonical: the offers' collection target check (D2342). */
  existingCollectionIds(
    ctx: OffersOperationContext,
    scope: OffersStoreScope,
    collectionIds: readonly string[],
  ): Promise<readonly string[]> {
    return this.queries.existingCollectionIds(asOperationContext(ctx), scope, collectionIds);
  }
}
