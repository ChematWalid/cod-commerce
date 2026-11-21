import { describe, expect, it } from 'vitest';
import {
  BULK_NOTHING_CHANGED_MESSAGE_ID,
  BULK_PRICE_INVALID_MESSAGE_ID,
  type BulkForm,
  bulkRequestOf,
  CLEAR_BRAND,
  emptyBulkForm,
  phaseAfterAnswer,
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
    if (!first.ok) throw new Error('the form must be valid');
    const reviewed = phaseAfterAnswer(first.input, first) ?? 'edit';
    const second = bulkRequestOf(form, ids, reviewed);
    if (!second.ok) throw new Error('the form must be valid');
    const done = phaseAfterAnswer(second.input, second);

    // Assert
    expect(first.input.dryRun).toBe(true);
    expect(reviewed).toBe('reviewed');
    expect(second.input.dryRun).toBe(false);
    expect(second.input.productIds).toEqual(ids);
    expect(done).toBe('applied');
  });

  it('an answer for an older form does not unlock apply', () => {
    // Arrange: a dry run of "status draft" is in flight when the merchant also sets a fixed price
    const sent = bulkRequestOf({ ...emptyBulkForm(), status: 'draft' }, ids, 'edit');
    const changed = bulkRequestOf(
      { ...emptyBulkForm(), status: 'draft', priceMode: 'fixed', priceValue: '0' },
      ids,
      'edit',
    );
    const same = bulkRequestOf({ ...emptyBulkForm(), status: 'draft' }, ids, 'edit');
    if (!sent.ok) throw new Error('the sent form must be valid');

    // Act
    const stale = phaseAfterAnswer(sent.input, changed);
    const invalidNow = phaseAfterAnswer(sent.input, bulkRequestOf(emptyBulkForm(), ids, 'edit'));
    const current = phaseAfterAnswer(sent.input, same);

    // Assert
    expect(stale).toBeNull();
    expect(invalidNow).toBeNull();
    expect(current).toBe('reviewed');
  });

  it('an apply answer always ends in applied, since the products were written', () => {
    // Arrange
    const form: BulkForm = { ...emptyBulkForm(), status: 'draft' };
    const applied = bulkRequestOf(form, ids, 'reviewed');
    if (!applied.ok) throw new Error('the applied form must be valid');

    // Act
    const phase = phaseAfterAnswer(applied.input, bulkRequestOf({ ...form, status: 'active' }, ids, 'edit'));

    // Assert
    expect(phase).toBe('applied');
  });
});
