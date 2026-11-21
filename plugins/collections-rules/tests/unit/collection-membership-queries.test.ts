import { beforeEach, describe, expect, it } from 'vitest';
import { CollectionMembershipQueries } from '../../application/collection-membership-queries.service';
import { DeleteCollectionService } from '../../application/delete-collection.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { automaticCollection, manualCollection } from '../support/arrange-collections';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const ctx = asOperationContext({});
const MALFORMED = ['abc', '-1', '1.5', '99999999999999999999', ''];

let world: FakeCollectionWorld;
const queries = () => new CollectionMembershipQueries(world.ports);

/** A manual collection of `scope` holding `productIds` in that order. */
async function manualWith(scope: StoreScope, ...productIds: string[]): Promise<string> {
  const collectionId = await manualCollection(world, scope);
  const rows = productIds.map((productId, position) => ({ productId, position }));
  await world.tables.members.replaceMembers(ctx, scope, collectionId, rows);
  return collectionId;
}

beforeEach(() => {
  world = new FakeCollectionWorld();
});

describe('CollectionMembershipQueries (D2317)', () => {
  it('productIdsOf returns rule and manual members of the store only', async () => {
    // Arrange
    const manual = await manualWith(scopeA, '3', '1');
    const automatic = await automaticCollection(world, scopeA, ['5', '8']);
    const foreign = await manualWith(scopeB, '7');
    const otherStore = await manualWith(scopeA2, '9');

    // Act
    const [manualIds, automaticIds, foreignIds, otherStoreIds, malformedIds] = await Promise.all(
      [manual, automatic, foreign, otherStore, 'abc'].map((id) => queries().productIdsOf(ctx, scopeA, id)),
    );

    // Assert
    expect(manualIds).toEqual(['3', '1']);
    expect(automaticIds).toEqual(['8', '5']);
    expect([foreignIds, otherStoreIds, malformedIds]).toEqual([[], [], []]);
  });

  it("collectionIdsOfProducts answers N products in one call, B's ids absent", async () => {
    // Arrange
    const first = await manualWith(scopeA, '1', '2');
    const second = await automaticCollection(world, scopeA, ['2']);
    await manualWith(scopeB, '1', '3');

    // Act
    const found = await queries().collectionIdsOfProducts(ctx, scopeA, ['1', '2', '3', ...MALFORMED]);

    // Assert
    expect(found).toEqual(
      new Map([
        ['1', [first]],
        ['2', [first, second].sort((left, right) => Number(BigInt(left) - BigInt(right)))],
      ]),
    );
  });

  it('collectionIdsOfProducts of no well-formed product answers an empty map', async () => {
    // Act
    const found = await queries().collectionIdsOfProducts(ctx, scopeA, MALFORMED);

    // Assert
    expect(found.size).toBe(0);
  });

  it("isMember is true only for the store's member, whatever the id spelling", async () => {
    // Arrange
    const collectionId = await manualWith(scopeA, '4');
    const foreign = await manualWith(scopeB, '4');

    // Act
    const answers = await Promise.all([
      queries().isMember(ctx, scopeA, collectionId, '4'),
      queries().isMember(ctx, scopeA, collectionId, '04'),
      queries().isMember(ctx, scopeA, collectionId, '5'),
      queries().isMember(ctx, scopeA, foreign, '4'),
      queries().isMember(ctx, scopeA, 'abc', '4'),
      queries().isMember(ctx, scopeA, collectionId, 'abc'),
    ]);

    // Assert
    expect(answers).toEqual([true, true, false, false, false, false]);
  });

  it("existingCollectionIds drops B's and deleted ids", async () => {
    // Arrange
    const kept = await manualWith(scopeA);
    const deleted = await manualWith(scopeA);
    const foreign = await manualWith(scopeB);
    await new DeleteCollectionService(world.ports).delete(ctx, scopeA, deleted);

    // Act
    const found = await queries().existingCollectionIds(ctx, scopeA, [foreign, deleted, kept, ...MALFORMED]);

    // Assert
    expect(found).toEqual([kept]);
  });
});
