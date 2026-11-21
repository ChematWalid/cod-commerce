import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OFFERS_COLLECTION_TARGET_CASES } from '../isolation/cases/offers-collection-targets';
import { COLLECTION_WORLDS } from '../isolation/collections-world';
import type { World } from '../isolation/world-types';
import { businessOf, collectionsOf } from './p2-isolation-fixtures';

describe('P2 isolation offers collection target cells (#273, D2342)', () => {
  const world: World = { a: businessOf('A'), b: businessOf('B'), superadmin: { label: 'superadmin', token: 's' } };

  beforeAll(() => {
    for (const label of ['A', 'B'] as const) COLLECTION_WORLDS.set(label, collectionsOf(label));
  });

  afterAll(() => {
    COLLECTION_WORLDS.clear();
  });

  it.each([
    ['offers.createOffer.foreign-collection', { kind: 'code', code: 'offers.unknown-targets' }, '72'],
    ['offers.post-/offers.foreign-collection', { kind: 'status', status: 422, code: 'offers.unknown-targets' }, '72'],
    ['offers.createOffer.other-store-collection', { kind: 'code', code: 'offers.unknown-targets' }, '91'],
    [
      'offers.post-/offers.other-store-collection',
      { kind: 'status', status: 422, code: 'offers.unknown-targets' },
      '91',
    ],
  ])("refuses %s, a collection that is not the store's own", (id, expected, collectionId) => {
    // Act
    const cell = OFFERS_COLLECTION_TARGET_CASES.find((testCase) => testCase.id === id);
    const request = cell?.request(world.a, world.b, world);

    // Assert
    expect(cell?.expect).toEqual(expected);
    expect(cell?.access).toBe('write');
    expect(request?.caller).toBe(world.a.owner);
    expect(request?.channel?.token).toBe(world.a.stores[0].channelToken);
    expect(JSON.stringify(request?.body)).toContain(`"refType":"collection","refId":"${collectionId}"`);
  });
});
