import { type CatalogProductFactsReader, CatalogStoreChannelMismatchError } from '@cod/plugin-catalog';
import { Logger } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogProductWeights } from '../../infrastructure/catalog-product-weights.adapter';
import { ctx, STORE_A1 } from '../support/world';

/** The adapter over a reader whose `weightsOf` runs `read`. */
const adapterOver = (read: () => Promise<ReadonlyMap<string, number | null>>) =>
  new CatalogProductWeights({ weightsOf: read } as unknown as CatalogProductFactsReader);

describe('CatalogProductWeights', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers the reader's weights by product id", async () => {
    // Arrange
    const adapter = adapterOver(() => Promise.resolve(new Map([['7', 2000]])));

    // Act
    const weights = await adapter.weightsOf(ctx, STORE_A1, ['7']);

    // Assert
    expect(weights).toEqual(new Map([['7', 2000]]));
  });

  it("answers 'unreadable' and warns with the store id when the context is off the store's channel (#293)", async () => {
    // Arrange
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const adapter = adapterOver(() => Promise.reject(new CatalogStoreChannelMismatchError()));

    // Act
    const weights = await adapter.weightsOf(ctx, STORE_A1, ['7']);

    // Assert
    expect(weights).toBe('unreadable');
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain(String(STORE_A1.storeId));
  });

  it('lets any other reader error propagate', async () => {
    // Arrange
    const failure = new Error('database down');
    const adapter = adapterOver(() => Promise.reject(failure));

    // Act and Assert
    await expect(adapter.weightsOf(ctx, STORE_A1, ['7'])).rejects.toBe(failure);
  });
});
