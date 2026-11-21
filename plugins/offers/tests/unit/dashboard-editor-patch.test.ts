import type { OfferAppType } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { emptyOfferForm, type OfferEditorForm } from '../../dashboard/model/editor-form';
import { isEmptyPatch, offerPatchOf, toOfferInput } from '../../dashboard/model/editor-patch';

const ORDER_DISCOUNT_TYPE: OfferAppType = {
  id: 'order_discount',
  kind: 'order_discount',
  method: 'automatic',
  goal: null,
  recommended: false,
};

const typedForm = (change: Partial<OfferEditorForm> = {}): OfferEditorForm => ({
  ...emptyOfferForm(ORDER_DISCOUNT_TYPE, null),
  title: ' Big basket ',
  ...change,
});

describe('offer editor input', () => {
  it('builds an offer input from the form without unset keys', () => {
    // Act
    const input = toOfferInput(typedForm({ label: { ar: '  ', en: 'Basket' } }));

    // Assert
    expect(input.config).toMatchObject({ valueType: 'percent' });
    expect(input).toEqual({
      kind: 'order_discount',
      method: 'automatic',
      title: 'Big basket',
      label: { en: 'Basket' },
      config: input.config,
      combinesWith: { order: false, product: false, delivery: false },
      eligibility: { audience: 'everyone', channels: [], wilayas: [], deliveryMethods: [] },
      targets: [],
    });
    expect(Object.keys(input)).not.toEqual(expect.arrayContaining(['startsAt', 'endsAt', 'totalUsageLimit']));
  });

  it('writes a dated start and typed limits in UTC and as numbers', () => {
    // Act
    const input = toOfferInput(
      typedForm({ startMode: 'date', startsAt: '2026-12-01T10:00', endsAt: '2026-12-31T23:30', perBuyerLimit: '2' }),
    );

    // Assert
    expect(input).toMatchObject({
      startsAt: '2026-12-01T09:00:00.000Z',
      endsAt: '2026-12-31T22:30:00.000Z',
      perBuyerLimit: 2,
    });
  });

  it('patches only changed fields with the version', () => {
    // Arrange
    const saved = typedForm({ totalUsageLimit: '50', startMode: 'date', startsAt: '2026-12-01T10:00' });
    const edited = { ...saved, title: 'Bigger basket', totalUsageLimit: '', startMode: 'publish' as const };

    // Act
    const patch = offerPatchOf(saved, edited, 4);
    const unchanged = offerPatchOf(saved, saved, 4);

    // Assert
    expect(patch).toEqual({
      input: { title: 'Bigger basket', totalUsageLimit: null, startsAt: null },
      version: 4,
    });
    expect(isEmptyPatch(unchanged)).toBe(true);
    expect(isEmptyPatch(patch)).toBe(false);
  });
});
