import { describe, expect, it } from 'vitest';
import {
  BULK_NOTHING_CHANGED_MESSAGE_ID,
  BULK_PRICE_INVALID_MESSAGE_ID,
  type BulkForm,
  bulkRequestOf,
  CLEAR_BRAND,
  emptyBulkForm,
  nextBulkPhase,
} from '../../dashboard/model/bulk-form';

const ids = ['11', '12'];

describe('bulk edit form', () => {
  it('only changed fields are sent', () => {
    // Arrange
    const statusOnly: BulkForm = { ...emptyBulkForm(), status: 'draft' };
    const priceAndBrand: BulkForm = { ...emptyBulkForm(), priceMode: 'percent', priceValue: '-10', brandId: '5' };
    const clearBrandAndTags: BulkForm = { ...emptyBulkForm(), brandId: CLEAR_BRAND, addTagId: '8', removeTagId: '9' };

    // Act
    const requests = [statusOnly, priceAndBrand, clearBrandAndTags].map((form) => bulkRequestOf(form, ids, 'edit'));

    // Assert
    expect(requests.map((request) => (request.ok ? request.input.changes : null))).toEqual([
      { status: 'draft' },
      { brandId: '5', price: { mode: 'percent', value: -10 } },
      { brandId: null, addTagIds: ['8'], removeTagIds: ['9'] },
    ]);
  });

  it('refuses a form that changes nothing or a price that is no number', () => {
    // Act
    const nothing = bulkRequestOf(emptyBulkForm(), ids, 'edit');
    const badPrice = bulkRequestOf({ ...emptyBulkForm(), priceMode: 'fixed', priceValue: '12abc' }, ids, 'edit');

    // Assert
    expect(nothing).toEqual({ ok: false, messageId: BULK_NOTHING_CHANGED_MESSAGE_ID });
    expect(badPrice).toEqual({ ok: false, messageId: BULK_PRICE_INVALID_MESSAGE_ID });
  });

  it('dry run first, then apply', () => {
    // Arrange
    const form: BulkForm = { ...emptyBulkForm(), status: 'draft' };

    // Act
    const first = bulkRequestOf(form, ids, 'edit');
    const reviewed = nextBulkPhase('edit');
    const second = bulkRequestOf(form, ids, reviewed);
    const done = nextBulkPhase(reviewed);

    // Assert
    expect(first.ok && first.input.dryRun).toBe(true);
    expect(reviewed).toBe('reviewed');
    expect(second.ok && second.input.dryRun).toBe(false);
    expect(second.ok && second.input.productIds).toEqual(ids);
    expect(done).toBe('applied');
    expect(nextBulkPhase('applied')).toBe('applied');
  });
});
