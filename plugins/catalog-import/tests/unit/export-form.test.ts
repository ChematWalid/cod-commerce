import { type CatalogProductListPageEntity, EXPORT_SYNC_MAX_ROWS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  defaultExportForm,
  EXPORT_SELECT_FIRST_MESSAGE_ID,
  EXPORT_TOO_MANY_SELECTED_MESSAGE_ID,
  exportRequestOf,
} from '../../dashboard/model/export-form';

const entityOf = (selectedIds: readonly string[]): CatalogProductListPageEntity => ({
  query: { tab: 'draft', q: 'shirt', brandId: '77', skip: 40, take: 20 },
  selectedIds,
});

describe('export form', () => {
  it('selected scope needs ids', () => {
    // Act
    const none = exportRequestOf({ scope: 'selected', format: 'csv' }, entityOf([]));
    const two = exportRequestOf({ scope: 'selected', format: 'csv' }, entityOf(['11', '12']));

    // Assert
    expect(none).toEqual({ ok: false, messageId: EXPORT_SELECT_FIRST_MESSAGE_ID });
    expect(two).toEqual({ ok: true, input: { scope: 'selected', format: 'csv', productIds: ['11', '12'] } });
  });

  it('refuses more selected ids than one export takes', () => {
    // Arrange
    const ids = Array.from({ length: EXPORT_SYNC_MAX_ROWS + 1 }, (_, index) => String(index + 1));

    // Act
    const request = exportRequestOf({ scope: 'selected', format: 'xlsx' }, entityOf(ids));

    // Assert
    expect(request).toEqual({ ok: false, messageId: EXPORT_TOO_MANY_SELECTED_MESSAGE_ID });
  });

  it('filtered scope copies the list query', () => {
    // Act
    const request = exportRequestOf({ scope: 'filtered', format: 'xlsx' }, entityOf(['11']));

    // Assert: the whole filter, not the list's page
    expect(request).toEqual({
      ok: true,
      input: { scope: 'filtered', format: 'xlsx', query: { tab: 'draft', q: 'shirt', brandId: '77' } },
    });
  });

  it('starts on the selection when there is one, else on the filter', () => {
    // Act / Assert
    expect(defaultExportForm(entityOf(['11']))).toEqual({ scope: 'selected', format: 'xlsx' });
    expect(defaultExportForm(entityOf([]))).toEqual({ scope: 'filtered', format: 'xlsx' });
    expect(defaultExportForm(undefined)).toEqual({ scope: 'filtered', format: 'xlsx' });
  });
});
