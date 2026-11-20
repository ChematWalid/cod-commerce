import type { GatedLine, UnitPriceResolver, UnitPriceResolverRegistrar } from '@cod/plugin-offers';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { PackPricesService } from '../../application/pack-prices.service';
import { PackUnitPriceResolver } from '../../infrastructure/pack-unit-price.resolver';
import { aPackRecord, aProduct } from '../support/builders';
import { packWorld, SCOPE_A, SCOPE_B } from '../fakes/pack-world';

const CTX = {} as RequestContext;

/** The offers' registrar as the resolver sees it, recording what registers. */
class RecordingRegistrar implements UnitPriceResolverRegistrar {
  readonly registered: UnitPriceResolver[] = [];

  register(resolver: UnitPriceResolver): void {
    this.registered.push(resolver);
  }
}

function arranged() {
  const world = packWorld();
  world.catalog.put(
    SCOPE_A,
    aProduct({ id: '11', price: 1500, weight: 300 }),
    aProduct({ id: '12', price: 2000, weight: 500 }),
    aProduct({ id: '20', type: 'pack', price: 1 }),
  );
  world.packs.put(SCOPE_A, aPackRecord('20'));
  const registrar = new RecordingRegistrar();
  return { ...world, registrar, resolver: new PackUnitPriceResolver(new PackPricesService(world.ports), registrar) };
}

describe('PackUnitPriceResolver (D2204, D2276)', () => {
  it('registers itself once with the offers unit price registrar on bootstrap', () => {
    // Arrange
    const { registrar, resolver } = arranged();

    // Act
    resolver.onApplicationBootstrap();

    // Assert
    expect(registrar.registered).toEqual([resolver]);
  });

  it("answers the offers' UnitPriceResolver port under the key pack", async () => {
    // Arrange: typed as the offers' port, as their registry calls it
    const { resolver } = arranged();
    const port: UnitPriceResolver = resolver;

    // Act
    const prices = await port.resolve(CTX, SCOPE_A, [{ productId: '20', variantId: '2001' } as GatedLine]);

    // Assert
    expect(port.key).toBe('pack');
    expect(prices.get('2001')).toMatchObject({ unitPrice: 3150, source: 'pack' });
  });

  it('returns price, original price and weight per pack variant', async () => {
    // Arrange
    const { resolver } = arranged();

    // Act
    const prices = await resolver.resolve(CTX, SCOPE_A, [{ productId: '20', variantId: '2001' }]);

    // Assert: computed live, not the stored 1
    expect(resolver.key).toBe('pack');
    expect(prices.get('2001')).toEqual({ unitPrice: 3150, originalPrice: 3500, source: 'pack', weightGrams: 800 });
  });

  it('omits a stale pack', async () => {
    // Arrange
    const { packs, resolver } = arranged();
    packs.put(SCOPE_A, aPackRecord('20', { status: 'stale' }));

    // Act
    const prices = await resolver.resolve(CTX, SCOPE_A, [{ productId: '20', variantId: '2001' }]);

    // Assert
    expect(prices.size).toBe(0);
  });

  it('omits a non-pack variant', async () => {
    // Arrange
    const { resolver } = arranged();

    // Act
    const prices = await resolver.resolve(CTX, SCOPE_A, [
      { productId: '11', variantId: '1101' },
      { productId: '20', variantId: '1101' },
    ]);

    // Assert
    expect(prices.size).toBe(0);
  });

  it('drops a line whose product is not in the scope', async () => {
    // Arrange
    const { resolver } = arranged();

    // Act
    const prices = await resolver.resolve(CTX, SCOPE_B, [{ productId: '20', variantId: '2001' }]);

    // Assert
    expect(prices.size).toBe(0);
  });

  it('prices each value of a shared-option pack', async () => {
    // Arrange
    const { catalog, packs, resolver } = arranged();
    const sized = (id: string, price: number) =>
      aProduct({
        id,
        price,
        optionGroups: [{ name: 'Size', values: ['M', 'L'] }],
        variants: [
          { id: `${id}01`, price, optionValues: ['M'] },
          { id: `${id}02`, price: price + 100, optionValues: ['L'] },
        ],
      });
    catalog.put(SCOPE_A, sized('11', 1500), sized('12', 2000), {
      ...aProduct({ id: '20', type: 'pack' }),
      optionGroups: [{ name: 'Size', values: ['M', 'L'] }],
      variants: [
        { id: '2001', price: 1, optionValues: ['M'] },
        { id: '2002', price: 1, optionValues: ['L'] },
      ],
    });
    packs.put(SCOPE_A, aPackRecord('20', { packVariantMode: 'shared_option', packSharedOption: 'Size' }));

    // Act
    const prices = await resolver.resolve(CTX, SCOPE_A, [
      { productId: '20', variantId: '2001' },
      { productId: '20', variantId: '2002' },
    ]);

    // Assert: (1 500 + 2 000) × 0.9 and (1 600 + 2 100) × 0.9
    expect(prices.get('2001')?.unitPrice).toBe(3150);
    expect(prices.get('2002')?.unitPrice).toBe(3330);
  });
});
