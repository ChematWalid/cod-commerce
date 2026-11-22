import { describe, expect, it } from 'vitest';
import { expectedKeysOf, FIXTURE_PRODUCTS, FIXTURE_QUERIES, scoreOf } from '../fixtures/search-fixture';
import { QUERY_CLASS_COUNTS } from '../fixtures/search-fixture-queries';

describe('the search recall fixture (D3208)', () => {
  it('holds 300 distinct names, 100 per store', () => {
    // Act
    const perStore = [0, 1, 2].map((store) => FIXTURE_PRODUCTS.filter((product) => product.store === store));

    // Assert
    expect(FIXTURE_PRODUCTS).toHaveLength(300);
    expect(perStore.map((names) => names.length)).toEqual([100, 100, 100]);
    for (const names of perStore) expect(new Set(names.map((product) => product.name)).size).toBe(names.length);
  });

  it("holds 60 queries in spike E's classes, two of them cross-script", () => {
    // Act
    const counts = Object.fromEntries(
      Object.keys(QUERY_CLASS_COUNTS).map((kind) => [
        kind,
        FIXTURE_QUERIES.filter((query) => query.kind === kind).length,
      ]),
    );

    // Assert
    expect(FIXTURE_QUERIES).toHaveLength(60);
    expect(counts).toEqual(QUERY_CLASS_COUNTS);
    expect(FIXTURE_QUERIES.filter((query) => query.crossScript === true)).toHaveLength(2);
  });

  it('expects at least one product of the same store for every query', () => {
    // Assert
    for (const query of FIXTURE_QUERIES) {
      const expected = expectedKeysOf(query);
      expect(expected.length, query.q).toBeGreaterThan(0);
      expect(
        expected.every((key) => key.startsWith(`${String(query.store)}/`)),
        query.q,
      ).toBe(true);
    }
  });

  it('scores recall over the answers that fit in the depth, and the rank of the first hit', () => {
    // Act / Assert
    expect(scoreOf(['a', 'b'], ['x', 'a', 'b'])).toEqual({ recall: 1, reciprocalRank: 0.5 });
    expect(scoreOf(['a', 'b', 'c', 'd', 'e', 'f', 'g'], ['a', 'b', 'c', 'x', 'y', 'd'])).toEqual({
      recall: 0.6,
      reciprocalRank: 1,
    });
    expect(scoreOf(['a'], [])).toEqual({ recall: 0, reciprocalRank: 0 });
  });
});
