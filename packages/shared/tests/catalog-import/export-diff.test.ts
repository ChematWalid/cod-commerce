import { describe, expect, it } from 'vitest';
import { productExportDiffSchema } from '../../src/index';

describe('productExportDiffSchema', () => {
  it('records the scope, format, row count and skipped packs of one export', () => {
    expect(
      productExportDiffSchema.safeParse({ scope: 'filtered', format: 'csv', rowCount: 12, skippedPacks: 1 }).success,
    ).toBe(true);
    expect(
      productExportDiffSchema.safeParse({ scope: 'all', format: 'csv', rowCount: 12, skippedPacks: 0 }).success,
    ).toBe(false);
    expect(
      productExportDiffSchema.safeParse({ scope: 'selected', format: 'pdf', rowCount: 1, skippedPacks: 0 }).success,
    ).toBe(false);
    expect(
      productExportDiffSchema.safeParse({ scope: 'selected', format: 'xlsx', rowCount: -1, skippedPacks: 0 }).success,
    ).toBe(false);
  });
});
