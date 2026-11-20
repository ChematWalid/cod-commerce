import type { ConfigService, Product, ProductService, ProductVariant, ProductVariantService } from '@vendure/core';
import { DefaultProductVariantPriceSelectionStrategy } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { toCoreId } from '../../domain/core-id';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { VendureVariantGate } from '../../infrastructure/variant-gate';
import { scopeA } from '../support/offer-records';

const STORE_CHANNEL_ID = 7;
const CURRENCY = 'DZD';
const ctx = asOperationContext({ channelId: STORE_CHANNEL_ID, currencyCode: CURRENCY });

interface VariantShape {
  readonly id: number;
  readonly productId: number;
  readonly enabled?: boolean;
  readonly deletedAt?: Date | null;
  readonly isHidden?: boolean;
  readonly priceChannelId?: number | null;
}

/** A variant as `ProductVariantService.findByIds` returns it, with a price row in `priceChannelId` unless null. */
function aVariant({
  id,
  productId,
  enabled = true,
  deletedAt = null,
  isHidden = false,
  priceChannelId = STORE_CHANNEL_ID,
}: VariantShape) {
  const prices = priceChannelId === null ? [] : [{ channelId: priceChannelId, currencyCode: CURRENCY, price: 4_900 }];
  const customFields = { isHidden };
  return {
    id,
    productId,
    enabled,
    deletedAt,
    customFields,
    price: 4_900,
    productVariantPrices: prices,
  } as unknown as ProductVariant;
}

/** A gate over Vendure services that return `variants` and an enabled product for each of their product ids. */
function aGateOver(variants: readonly ProductVariant[]): VendureVariantGate {
  const variantService = { findByIds: () => Promise.resolve([...variants]) } as unknown as ProductVariantService;
  const productService = {
    findByIds: (_ctx: unknown, ids: readonly string[]) =>
      Promise.resolve(ids.map((id) => ({ id: Number(id), enabled: true }) as unknown as Product)),
  } as unknown as ProductService;
  const config = {
    catalogOptions: { productVariantPriceSelectionStrategy: new DefaultProductVariantPriceSelectionStrategy() },
  } as unknown as ConfigService;
  return new VendureVariantGate(variantService, productService, config);
}

describe('VendureVariantGate', () => {
  it('accepts an enabled variant priced in the store channel', async () => {
    // Arrange
    const gate = aGateOver([aVariant({ id: 11, productId: 1 })]);

    // Act
    const accepted = await gate.accept(ctx, scopeA, [toCoreId('11')]);

    // Assert
    expect(accepted.get('11')).toEqual({ variantId: '11', productId: '1', listPrice: 4_900 });
  });

  it('does not price a disabled variant', async () => {
    // Arrange
    const gate = aGateOver([aVariant({ id: 11, productId: 1, enabled: false })]);

    // Act
    const accepted = await gate.accept(ctx, scopeA, [toCoreId('11')]);

    // Assert
    expect(accepted.size).toBe(0);
  });

  it('does not price a variant the merchant hid', async () => {
    // Arrange: buyer reads drop a hidden variant (D2165), so a crafted id must not price it either.
    const gate = aGateOver([aVariant({ id: 11, productId: 1, isHidden: true })]);

    // Act
    const accepted = await gate.accept(ctx, scopeA, [toCoreId('11')]);

    // Assert
    expect(accepted.size).toBe(0);
  });

  it('does not price a variant with no price in the store channel', async () => {
    // Arrange: Vendure would report such a variant at price 0, a free line.
    const gate = aGateOver([
      aVariant({ id: 11, productId: 1, priceChannelId: null }),
      aVariant({ id: 12, productId: 1, priceChannelId: STORE_CHANNEL_ID + 1 }),
    ]);

    // Act
    const accepted = await gate.accept(ctx, scopeA, [toCoreId('11'), toCoreId('12')]);

    // Assert
    expect(accepted.size).toBe(0);
  });
});
