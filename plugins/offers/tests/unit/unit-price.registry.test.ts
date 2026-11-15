import { MONEY_MAX_DZD, type StoreId, type TenantScope } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { UnitPriceRegistry } from '../../application/unit-price.registry';
import { toCoreId } from '../../domain/core-id';
import { InvalidUnitPriceError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import type { GatedLine, ResolverPrice, UnitPriceResolver } from '../../domain/ports/unit-price-resolver.port';
import { aGatedVariant, FixedVariantGate } from '../fakes/fixed-variant-gate';
import { scopeA } from '../support/offer-records';

const ctx = asOperationContext({});
const ids = (...values: string[]) => values.map(toCoreId);

/** A resolver answering `answers` by variant id (for any line it is given) and recording the lines it saw. */
function aResolver(key: string, answers: Readonly<Record<string, ResolverPrice>>) {
  const seen: (readonly GatedLine[])[] = [];
  const resolver: UnitPriceResolver = {
    key,
    resolve: (_ctx, _scope, lines) => {
      seen.push(lines);
      return Promise.resolve(new Map(Object.entries(answers)));
    },
  };
  return { resolver, seen };
}

const packPrice = (unitPrice: number): ResolverPrice => ({ unitPrice, originalPrice: unitPrice + 100, source: 'pack' });

/** The scope P2.S2's pack plugin declares (`plugins/catalog-packs/domain/store-scope.ts`). */
interface PackStoreScope extends TenantScope {
  readonly storeId: StoreId;
}

/**
 * P2.S2's `PackUnitPriceResolver` as its branch declares it (D2441): Vendure's `RequestContext`, string ids, the
 * literal key `'pack'` and a result with `source: 'pack'` and `weightGrams`. Registering it unchanged must typecheck.
 */
class PackShapedResolver {
  readonly key = 'pack';

  resolve(
    _ctx: RequestContext,
    _scope: PackStoreScope,
    lines: readonly { readonly productId: string; readonly variantId: string }[],
  ): Promise<ReadonlyMap<string, { unitPrice: number; originalPrice: number; source: 'pack'; weightGrams: number }>> {
    return Promise.resolve(
      new Map(
        lines.map((line) => [
          line.variantId,
          { unitPrice: 9_100, originalPrice: 9_800, source: 'pack', weightGrams: 1_200 },
        ]),
      ),
    );
  }
}

describe('UnitPriceRegistry', () => {
  it('prices with the first registered resolver that re-prices the variant', async () => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([aGatedVariant('11', '1', 4_900)]));
    const first = aResolver('first', { '11': packPrice(3_000) });
    const second = aResolver('second', { '11': packPrice(2_000) });
    registry.register(first.resolver);
    registry.register(second.resolver);

    // Act
    const prices = await registry.pricesOf(ctx, scopeA, ids('11'));

    // Assert
    expect(prices.get('11')).toEqual({
      variantId: '11',
      productId: '1',
      unitPrice: 3_000,
      originalPrice: 3_100,
      source: 'pack',
    });
    expect(second.seen).toEqual([]);
  });

  it('passes a later resolver only the lines no earlier one re-priced', async () => {
    // Arrange
    const gate = new FixedVariantGate([aGatedVariant('11', '1', 4_900), aGatedVariant('12', '2', 1_500)]);
    const registry = new UnitPriceRegistry(gate);
    const first = aResolver('first', { '11': packPrice(3_000) });
    const second = aResolver('second', {});
    registry.register(first.resolver);
    registry.register(second.resolver);

    // Act
    await registry.pricesOf(ctx, scopeA, ids('11', '12'));

    // Assert
    expect(first.seen).toEqual([
      [
        { productId: '1', variantId: '11' },
        { productId: '2', variantId: '12' },
      ],
    ]);
    expect(second.seen).toEqual([[{ productId: '2', variantId: '12' }]]);
  });

  it('falls back to the variant list price', async () => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([aGatedVariant('11', '1', 4_900)]));
    registry.register(aResolver('pack', {}).resolver);

    // Act
    const prices = await registry.pricesOf(ctx, scopeA, ids('11'));

    // Assert
    expect(prices.get('11')).toEqual({
      variantId: '11',
      productId: '1',
      unitPrice: 4_900,
      originalPrice: 4_900,
      source: 'variant',
    });
  });

  it('never lets a registered resolver make a foreign or draft variant available', async () => {
    // Arrange: variant 99 is foreign or a draft's, so the gate refuses it; the resolver answers for every id.
    const gate = new FixedVariantGate([aGatedVariant('11', '1', 4_900)]);
    const registry = new UnitPriceRegistry(gate);
    const greedy = aResolver('greedy', { '11': packPrice(3_000), '99': packPrice(1) });
    registry.register(greedy.resolver);

    // Act
    const prices = await registry.pricesOf(ctx, scopeA, ids('11', '99'));

    // Assert
    expect([...prices.keys()]).toEqual(['11']);
    expect(gate.asked).toEqual([ids('11', '99')]);
    expect(greedy.seen).toEqual([[{ productId: '1', variantId: '11' }]]);
  });

  it("keeps the gate's productId whatever the resolver returns", async () => {
    // Arrange: a resolver that tries to move the line onto another (targeted) product.
    const registry = new UnitPriceRegistry(new FixedVariantGate([aGatedVariant('11', '1', 4_900)]));
    const sneaky: UnitPriceResolver = {
      key: 'sneaky',
      resolve: () =>
        Promise.resolve(new Map([['11', { ...packPrice(3_000), productId: '777', variantId: '55' } as ResolverPrice]])),
    };
    registry.register(sneaky);

    // Act
    const prices = await registry.pricesOf(ctx, scopeA, ids('11'));

    // Assert
    expect(prices.get('11')).toMatchObject({ variantId: '11', productId: '1', unitPrice: 3_000 });
  });

  it('refuses a second resolver with the same key', () => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([]));
    registry.register(aResolver('pack', {}).resolver);

    // Act
    const again = () => {
      registry.register(aResolver('pack', {}).resolver);
    };

    // Assert
    expect(again).toThrow(/pack/);
  });

  it.each([
    ['a negative unit price', { unitPrice: -1, originalPrice: 100, source: 'pack' }],
    ['a fractional unit price', { unitPrice: 10.5, originalPrice: 100, source: 'pack' }],
    ['a unit price above the money range', { unitPrice: MONEY_MAX_DZD + 1, originalPrice: 100, source: 'pack' }],
    ['an original price that is NaN', { unitPrice: 100, originalPrice: Number.NaN, source: 'pack' }],
    ['a negative weight', { unitPrice: 100, originalPrice: 100, source: 'pack', weightGrams: -5 }],
  ])('refuses %s from a resolver', async (_label, answer: ResolverPrice) => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([aGatedVariant('11', '1', 4_900)]));
    registry.register(aResolver('pack', { '11': answer }).resolver);

    // Act
    const priced = registry.pricesOf(ctx, scopeA, ids('11'));

    // Assert
    await expect(priced).rejects.toBeInstanceOf(InvalidUnitPriceError);
  });

  it.each([
    ['a null answer', null],
    ['a non-object answer', 42],
    ['an answer labelled as the list price', { unitPrice: 100, originalPrice: 100, source: 'variant' }],
    ['an answer without a source', { unitPrice: 100, originalPrice: 100 }],
  ])('refuses %s from a resolver', async (_label, answer: unknown) => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([aGatedVariant('11', '1', 4_900)]));
    registry.register(aResolver('pack', { '11': answer as ResolverPrice }).resolver);

    // Act
    const priced = registry.pricesOf(ctx, scopeA, ids('11'));

    // Assert
    await expect(priced).rejects.toBeInstanceOf(InvalidUnitPriceError);
  });

  it.each([
    ['negative', -5],
    ['fractional', 12.5],
  ])('refuses a %s list price from the gate', async (_label, listPrice: number) => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([aGatedVariant('11', '1', listPrice)]));

    // Act
    const priced = registry.pricesOf(ctx, scopeA, ids('11'));

    // Assert
    await expect(priced).rejects.toBeInstanceOf(InvalidUnitPriceError);
  });

  it("registers P2.S2's pack resolver shape unchanged and keeps its weight", async () => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([aGatedVariant('31', '3', 9_999)]));

    // Act
    registry.register(new PackShapedResolver());
    const prices = await registry.pricesOf(ctx, scopeA, ids('31'));

    // Assert
    expect(prices.get('31')).toEqual({
      variantId: '31',
      productId: '3',
      unitPrice: 9_100,
      originalPrice: 9_800,
      source: 'pack',
      weightGrams: 1_200,
    });
  });

  it('asks no resolver when the gate accepts nothing', async () => {
    // Arrange
    const registry = new UnitPriceRegistry(new FixedVariantGate([]));
    const pack = aResolver('pack', { '99': packPrice(1) });
    registry.register(pack.resolver);

    // Act
    const prices = await registry.pricesOf(ctx, scopeA, ids('99'));

    // Assert
    expect(prices.size).toBe(0);
    expect(pack.seen).toEqual([]);
  });
});
