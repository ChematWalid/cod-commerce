import type { StoreId, TenantScope } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { SoldOutSourceRegistry } from '../../application/sold-out-source.registry';
import { type CoreId, toCoreId } from '../../domain/core-id';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { SoldOutSource } from '../../domain/ports/sold-out-source.port';
import { scopeA } from '../support/builders';
import { storeContext } from '../fakes/in-memory-product-catalog';

/** A source that calls every product of `soldOut` sold out, whatever the store. */
class FixedSoldOutSource implements SoldOutSource {
  constructor(private readonly soldOut: readonly CoreId[]) {}

  soldOutIds(
    _ctx: OperationContext,
    _scope: TenantScope,
    _storeId: StoreId,
    productIds: readonly CoreId[],
  ): Promise<ReadonlySet<string>> {
    return Promise.resolve(new Set(productIds.filter((id) => this.soldOut.includes(id))));
  }

  allSoldOutIds(): Promise<readonly CoreId[]> {
    return Promise.resolve(this.soldOut);
  }
}

const ctx = storeContext(scopeA.storeId);
const flagged = toCoreId('1');
const outOfStock = toCoreId('2');

describe('SoldOutSourceRegistry (D2107)', () => {
  it('answers from the default source until another one is registered', async () => {
    // Arrange
    const registry = new SoldOutSourceRegistry(new FixedSoldOutSource([flagged]));

    // Act
    const all = await registry.allSoldOutIds(ctx, scopeA, scopeA.storeId);
    const some = await registry.soldOutIds(ctx, scopeA, scopeA.storeId, [flagged, outOfStock]);

    // Assert
    expect(all).toEqual([flagged]);
    expect([...some]).toEqual([flagged]);
  });

  it('answers from the registered source instead of the default one', async () => {
    // Arrange
    const registry = new SoldOutSourceRegistry(new FixedSoldOutSource([flagged]));

    // Act
    registry.register(new FixedSoldOutSource([outOfStock]));

    // Assert
    expect(await registry.allSoldOutIds(ctx, scopeA, scopeA.storeId)).toEqual([outOfStock]);
    expect([...(await registry.soldOutIds(ctx, scopeA, scopeA.storeId, [flagged, outOfStock]))]).toEqual([outOfStock]);
  });

  it('refuses a second source rather than silently replacing the first', () => {
    // Arrange
    const registry = new SoldOutSourceRegistry(new FixedSoldOutSource([]));
    registry.register(new FixedSoldOutSource([]));

    // Act
    const registering = () => {
      registry.register(new FixedSoldOutSource([]));
    };

    // Assert
    expect(registering).toThrow(/already registered/);
  });
});
