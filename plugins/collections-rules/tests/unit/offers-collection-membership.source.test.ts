import {
  asOperationContext as asOffersContext,
  type CollectionMembership,
  type CollectionMembershipRegistrar,
  type CoreId,
} from '@cod/plugin-offers';
import { beforeEach, describe, expect, it } from 'vitest';
import { CollectionMembershipQueries } from '../../application/collection-membership-queries.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { OffersCollectionMembershipSource } from '../../infrastructure/offers-collection-membership.source';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const ctx = asOperationContext({});
const offersCtx = asOffersContext({});
/** Product ids as the offers carry them: trusted decimal strings in a test. */
const productIds = (...values: string[]): CoreId[] => values as CoreId[];

let world: FakeCollectionWorld;
let registered: CollectionMembership[];
let source: OffersCollectionMembershipSource;

beforeEach(() => {
  world = new FakeCollectionWorld();
  registered = [];
  const registrar: CollectionMembershipRegistrar = { register: (one) => registered.push(one) };
  source = new OffersCollectionMembershipSource(new CollectionMembershipQueries(world.ports), registrar);
});

describe('OffersCollectionMembershipSource (D2341)', () => {
  it('registers itself once on bootstrap', () => {
    // Act
    source.onApplicationBootstrap();

    // Assert
    expect(registered).toEqual([source]);
  });

  it('answers the collections of each product, manual and automatic, keyed by product id', async () => {
    // Arrange
    const manual = await manualCollection(world, scopeA);
    await world.tables.members.replaceMembers(ctx, scopeA, manual, [{ productId: '1', position: 0 }]);
    const automatic = await automaticCollection(world, scopeA, ['1', '2']);
    await automaticCollection(world, scopeA2, ['1']);
    await automaticCollection(world, scopeB, ['2']);

    // Act
    const answer = await source.collectionsOf(offersCtx, scopeA, productIds('1', '2', '3'));

    // Assert
    expect(Object.fromEntries(answer)).toEqual({
      '1': [manual, automatic],
      '2': [automatic],
    });
  });

  it("answers the store's own collections among the ids, never another store's or business's (D2342)", async () => {
    // Arrange
    const own = await manualCollection(world, scopeA);
    const otherStore = await manualCollection(world, scopeA2);
    const otherBusiness = await automaticCollection(world, scopeB, ['2']);

    // Act
    const existing = await source.existingCollectionIds(offersCtx, scopeA, [own, otherStore, otherBusiness, '404']);

    // Assert
    expect(existing).toEqual([own]);
  });

  it('answers an empty map for an empty cart', async () => {
    // Act
    const answer = await source.collectionsOf(offersCtx, scopeA, []);

    // Assert
    expect(answer.size).toBe(0);
  });
});
