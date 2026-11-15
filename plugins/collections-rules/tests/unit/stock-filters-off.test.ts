import type { CollectionService } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
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
});
