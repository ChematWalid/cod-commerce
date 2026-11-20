import type { OfferAppType } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { emptyOfferForm } from '../../dashboard/model/editor-form';
import { previewInputOf, sampleProductIdOf } from '../../dashboard/model/preview-input';

const QUANTITY_TYPE: OfferAppType = {
  id: 'quantity',
  kind: 'quantity',
  method: 'automatic',
  goal: 'sell_more',
  recommended: true,
};

describe('offer preview input', () => {
  it("builds preview input with the product's price as sample when known", () => {
    // Arrange
    const form = { ...emptyOfferForm(QUANTITY_TYPE, '42'), perBuyerLimit: '2', startMode: 'date' as const };

    // Act
    const known = previewInputOf(form, 3900);
    const unknown = previewInputOf(form, null);

    // Assert
    expect(sampleProductIdOf(form)).toBe('42');
    expect(known.samplePrice).toBe(3900);
    expect(known.offer).toMatchObject({
      kind: 'quantity',
      targets: [{ role: 'buy', refType: 'product', refId: '42' }],
    });
    expect(known.offer.title.length).toBeGreaterThan(0);
    expect(Object.keys(known.offer)).not.toEqual(expect.arrayContaining(['perBuyerLimit', 'startsAt']));
    expect('samplePrice' in unknown).toBe(false);
  });

  it('has no sample product without a product buy target', () => {
    // Act
    const sample = sampleProductIdOf(emptyOfferForm(QUANTITY_TYPE, null));

    // Assert
    expect(sample).toBeNull();
  });
});
