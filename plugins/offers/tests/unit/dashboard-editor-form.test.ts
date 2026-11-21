import { type OfferAppType, PRICING_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { OfferViewDto } from '../../dashboard/dto';
import {
  DATES_MESSAGE_ID,
  editorFormErrors,
  editorSearchOf,
  emptyOfferForm,
  LIMIT_MESSAGE_ID,
  offerFormOf,
  publishErrorsOf,
  TARGETS_MESSAGE_ID,
  TITLE_MESSAGE_ID,
} from '../../dashboard/model/editor-form';
import { toggleChannel } from '../../dashboard/model/channel-choice';
import { targetsOfRole, withoutTarget, withTarget } from '../../dashboard/model/target-list';

const QUANTITY_TYPE: OfferAppType = {
  id: 'quantity',
  kind: 'quantity',
  method: 'automatic',
  goal: 'sell_more',
  recommended: true,
};

const SAVED_OFFER: OfferViewDto = {
  id: '7340032',
  kind: 'product_discount',
  method: 'codes',
  title: 'Ramadan',
  label: { ar: 'تخفيض رمضان' },
  config: { appliesTo: 'all', valueType: 'percent', value: 10, cap: null, showCountdown: false },
  combinesWith: { order: true, product: false, delivery: false },
  eligibility: { audience: 'first', channels: ['storefront'], wilayas: [], deliveryMethods: [] },
  totalUsageLimit: 100,
  perBuyerLimit: null,
  status: 'draft',
  startsAt: '2026-12-01T09:00:00.000Z',
  endsAt: null,
  version: 3,
  targets: [],
  codeCount: 2,
  allowedMoves: ['publish', 'archive'],
  editable: true,
};

describe('offer editor form', () => {
  it('maps publish problems to the title, targets and dates fields', () => {
    // Arrange
    const refusal = {
      message: 'refused',
      extensions: { code: PRICING_ERROR_CODES.PUBLISH_INVALID, problems: ['title', 'targets', 'dates'] },
    };

    // Act
    const errors = publishErrorsOf(refusal);
    const other = publishErrorsOf({ extensions: { code: PRICING_ERROR_CODES.OFFER_CONFLICT } });

    // Assert
    expect(errors).toEqual({ title: TITLE_MESSAGE_ID, targets: TARGETS_MESSAGE_ID, dates: DATES_MESSAGE_ID });
    expect(other).toBeNull();
  });

  it('starts a new offer from its app type with the product of the link as a buy target', () => {
    // Act
    const form = emptyOfferForm(QUANTITY_TYPE, '42');

    // Assert
    expect(form).toMatchObject({ appTypeId: 'quantity', kind: 'quantity', method: 'automatic', startMode: 'publish' });
    expect(form.targets).toEqual([{ role: 'buy', refType: 'product', refId: '42' }]);
    expect(form.config).toEqual(expect.objectContaining({ priceMode: 'percent' }));
  });

  it('opens a saved offer with its start in Algeria time and its limits as typed text', () => {
    // Act
    const form = offerFormOf(SAVED_OFFER, 'discount_codes');

    // Assert
    expect(form).toMatchObject({
      appTypeId: 'discount_codes',
      startMode: 'date',
      startsAt: '2026-12-01T10:00',
      endsAt: '',
      totalUsageLimit: '100',
      perBuyerLimit: '',
    });
  });

  it('refuses a blank title, a zero limit and an end before the start before asking the server', () => {
    // Arrange
    const form = {
      ...offerFormOf(SAVED_OFFER, 'discount_codes'),
      title: '  ',
      perBuyerLimit: '0',
      endsAt: '2026-11-30T10:00',
    };

    // Act
    const errors = editorFormErrors(form);

    // Assert
    expect(errors).toEqual({ title: TITLE_MESSAGE_ID, limits: LIMIT_MESSAGE_ID, dates: DATES_MESSAGE_ID });
    expect(editorFormErrors(offerFormOf(SAVED_OFFER, 'discount_codes'))).toEqual({});
  });

  it('reads the app type and the product of the editor link, numbers included', () => {
    // Act
    const parsed = editorSearchOf({ type: 'quantity', productId: 42 });
    const bare = editorSearchOf({ productId: 'x1' });

    // Assert
    expect(parsed).toEqual({ type: 'quantity', productId: '42' });
    expect(bare).toEqual({ type: null, productId: null });
  });

  it('keeps every channel as the empty list and never unticks the last one', () => {
    // Act
    const withoutApp = toggleChannel([], 'app', false);
    const backToAll = toggleChannel(withoutApp, 'app', true);
    const last = toggleChannel(['storefront'], 'storefront', false);

    // Assert
    expect(withoutApp).toEqual(['storefront', 'landing_page', 'order_form_app', 'dashboard']);
    expect(backToAll).toEqual([]);
    expect(last).toEqual(['storefront']);
  });

  it('adds a target once, keeps each role under its cap and removes it again', () => {
    // Arrange
    const shirt = { role: 'buy' as const, refType: 'product' as const, refId: '1' };
    const cap = { role: 'addon' as const, refType: 'variant' as const, refId: '2' };
    const bag = { role: 'addon' as const, refType: 'variant' as const, refId: '3' };

    // Act
    const added = withTarget(withTarget(withTarget([shirt], shirt), cap, 1), bag, 1);
    const removed = withoutTarget(added, shirt);

    // Assert
    expect(added).toEqual([shirt, cap]);
    expect(targetsOfRole(added, 'addon')).toEqual([cap]);
    expect(removed).toEqual([cap]);
  });
});
