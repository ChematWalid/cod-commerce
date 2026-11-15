import type { CollectionService } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { COLLECTIONS_PROVIDERS } from '../../infrastructure/collections.providers';
import { StockFiltersOff } from '../../infrastructure/stock-filters-off';

describe('StockFiltersOff', () => {
  it('switches the stock recompute off on bootstrap', () => {
    // Arrange
    const setApplyAllFiltersOnProductUpdates = vi.fn();
    const collections = { setApplyAllFiltersOnProductUpdates } as unknown as CollectionService;
    const switcher = new StockFiltersOff(collections);

    // Act
    switcher.onApplicationBootstrap();

    // Assert
    expect(setApplyAllFiltersOnProductUpdates).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('is provided by the plugin, so the switch runs in the booted server', () => {
    // Arrange
    const providers = COLLECTIONS_PROVIDERS;

    // Act
    const provided = providers.includes(StockFiltersOff);

    // Assert
    expect(provided).toBe(true);
  });
});
