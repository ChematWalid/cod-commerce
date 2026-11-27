import { MONEY_MAX_DZD, type QuotePriceSource, shippingQuoteSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';
import { type DeliveryMethod, quoteDelivery } from '../../domain/quote';
import {
  commune,
  HOME_ONLY_TOWN,
  input,
  NO_OVERWEIGHT,
  OVERWEIGHT,
  STOPDESK_TOWN,
  UNRESOLVED,
  WILAYA,
} from '../support/quote-fixtures';

describe('quoteDelivery: the wilaya level', () => {
  it.each<[DeliveryMethod, number]>([
    ['home', 600],
    ['desk', 400],
  ])('prices %s delivery at the wilaya price', (method, price) => {
    // Act
    const quote = quoteDelivery(input({ method }));

    // Assert
    expect(quote).toEqual({
      baseFee: price,
      overweightFee: 0,
      totalFee: price,
      resolved: true,
      speed: 'standard',
      offeredSpeeds: ['standard'],
      freeShipping: false,
      waivedFee: 0,
      source: 'wilaya',
    });
    expect(shippingQuoteSchema.parse(quote)).toEqual(quote);
  });

  it('takes the wilaya override over its base', () => {
    // Arrange
    const rate = { ...WILAYA, overrideHome: 650, overrideDesk: 380 };

    // Act and Assert
    expect(quoteDelivery(input({ rate })).baseFee).toBe(650);
    expect(quoteDelivery(input({ rate, method: 'desk' })).baseFee).toBe(380);
  });

  it('answers unresolved for a wilaya with no rate row', () => {
    expect(quoteDelivery(input({ rate: null }))).toEqual(UNRESOLVED);
  });

  it.each<DeliveryMethod>(['home', 'desk'])('answers unresolved for %s when the wilaya does not deliver', (method) => {
    // Arrange
    const rate = { ...WILAYA, deliveryEnabled: false };

    // Act and Assert
    expect(quoteDelivery(input({ rate, method }))).toEqual(UNRESOLVED);
  });

  it('answers unresolved for desk when the wilaya has no stop desk, and still prices home', () => {
    // Arrange
    const rate = { ...WILAYA, deskEnabled: false };

    // Act and Assert
    expect(quoteDelivery(input({ rate, method: 'desk' }))).toEqual(UNRESOLVED);
    expect(quoteDelivery(input({ rate, method: 'home' })).resolved).toBe(true);
  });
});

describe('quoteDelivery: the commune layer (D3125)', () => {
  it.each<{
    label: string;
    communeRate: CommuneRateRow | null;
    method: DeliveryMethod;
    price: number;
    source: QuotePriceSource;
  }>([
    { label: 'no commune row', communeRate: null, method: 'home', price: 600, source: 'wilaya' },
    {
      label: 'a commune row without prices',
      communeRate: commune({ deskEnabled: true }),
      method: 'home',
      price: 600,
      source: 'wilaya',
    },
    {
      label: 'a commune row without prices (desk)',
      communeRate: commune({ deliveryEnabled: true }),
      method: 'desk',
      price: 400,
      source: 'wilaya',
    },
    {
      label: 'a commune base',
      communeRate: commune({ baseHome: 700, baseDesk: 450 }),
      method: 'home',
      price: 700,
      source: 'commune',
    },
    {
      label: 'a commune base (desk)',
      communeRate: commune({ baseHome: 700, baseDesk: 450 }),
      method: 'desk',
      price: 450,
      source: 'commune',
    },
    {
      label: 'a commune override',
      communeRate: commune({ baseHome: 700, overrideHome: 720 }),
      method: 'home',
      price: 720,
      source: 'commune',
    },
    {
      label: 'a commune override over a null base',
      communeRate: commune({ overrideDesk: 470 }),
      method: 'desk',
      price: 470,
      source: 'commune',
    },
    {
      label: 'a home-only commune price asked for desk',
      communeRate: commune({ baseHome: 700 }),
      method: 'desk',
      price: 400,
      source: 'wilaya',
    },
  ])('prices $label', ({ communeRate, method, price, source }) => {
    // Act
    const quote = quoteDelivery(input({ communeRate, method, town: STOPDESK_TOWN }));

    // Assert
    expect(quote).toMatchObject({ resolved: true, baseFee: price, totalFee: price, source });
  });

  it('lets an explicit commune "deliver" override a wilaya that does not deliver', () => {
    // Arrange
    const rate = { ...WILAYA, deliveryEnabled: false };
    const communeRate = commune({ deliveryEnabled: true });

    // Act and Assert
    expect(quoteDelivery(input({ rate, communeRate, town: STOPDESK_TOWN }))).toMatchObject({
      resolved: true,
      baseFee: 600,
      source: 'wilaya',
    });
  });

  it.each<DeliveryMethod>(['home', 'desk'])('lets an explicit commune "no delivery" block %s', (method) => {
    // Arrange
    const communeRate = commune({ deliveryEnabled: false, baseHome: 700, baseDesk: 450 });

    // Act and Assert
    expect(quoteDelivery(input({ communeRate, method, town: STOPDESK_TOWN }))).toEqual(UNRESOLVED);
  });

  it('lets the commune desk switch override the wilaya one, both ways', () => {
    // Arrange
    const noDeskWilaya = { ...WILAYA, deskEnabled: false };

    // Act
    const opened = quoteDelivery(
      input({ rate: noDeskWilaya, communeRate: commune({ deskEnabled: true }), town: STOPDESK_TOWN, method: 'desk' }),
    );
    const closed = quoteDelivery(
      input({ communeRate: commune({ deskEnabled: false }), town: STOPDESK_TOWN, method: 'desk' }),
    );

    // Assert
    expect(opened).toMatchObject({ resolved: true, baseFee: 400 });
    expect(closed).toEqual(UNRESOLVED);
  });

  it('refuses desk in a town without a reference stop desk, whatever the switches say, and keeps home', () => {
    // Arrange
    const communeRate = commune({ deskEnabled: true, deliveryEnabled: true });

    // Act and Assert
    expect(quoteDelivery(input({ communeRate, town: HOME_ONLY_TOWN, method: 'desk' }))).toEqual(UNRESOLVED);
    expect(quoteDelivery(input({ communeRate, town: HOME_ONLY_TOWN, method: 'home' })).resolved).toBe(true);
  });

  it('desk does not need a stop-desk town when no town is named (wilaya level alone)', () => {
    expect(quoteDelivery(input({ town: null, method: 'desk' })).resolved).toBe(true);
  });
});

describe('quoteDelivery: overweight (D3121)', () => {
  it.each([
    ['no weight', 0, 0],
    ['exactly the allowance', 5000, 0],
    ['one gram above the allowance', 5001, 50],
    ['one started kilogram above', 6000, 50],
    ['a gram into the second extra kilogram', 6001, 100],
    ['ten kilograms above', 15000, 500],
  ])('charges %s', (_label, weightGrams, fee) => {
    // Act
    const quote = quoteDelivery(input({ group: OVERWEIGHT, weightGrams }));

    // Assert
    expect(quote).toMatchObject({ baseFee: 600, overweightFee: fee, totalFee: 600 + fee });
  });

  it('charges nothing when the group does not charge overweight', () => {
    expect(quoteDelivery(input({ group: NO_OVERWEIGHT, weightGrams: 50_000 })).overweightFee).toBe(0);
  });

  it('takes the overweight settings from the group even when a commune prices the delivery', () => {
    // Arrange
    const communeRate = commune({ baseHome: 700 });

    // Act and Assert
    expect(quoteDelivery(input({ group: OVERWEIGHT, communeRate, weightGrams: 7000 }))).toMatchObject({
      baseFee: 700,
      overweightFee: 100,
      totalFee: 800,
      source: 'commune',
    });
  });

  it('prices a total of exactly the money ceiling', () => {
    // Arrange: 600 home plus one DZD per started kilogram from the first gram.
    const perKg = { ...OVERWEIGHT, overweightAllowanceKg: 0, overweightRate: 1 };
    const weightGrams = (MONEY_MAX_DZD - 600) * 1000;

    // Act
    const quote = quoteDelivery(input({ group: perKg, weightGrams }));

    // Assert
    expect(quote).toMatchObject({ resolved: true, baseFee: 600, totalFee: MONEY_MAX_DZD });
  });

  it('answers unresolved instead of overflowing when the total passes the money ceiling by 1 DZD', () => {
    // Arrange: a whole, safe weight, so only the ceiling can refuse it.
    const perKg = { ...OVERWEIGHT, overweightAllowanceKg: 0, overweightRate: 1 };
    const weightGrams = (MONEY_MAX_DZD - 600 + 1) * 1000;

    // Act and Assert
    expect(Number.isSafeInteger(weightGrams)).toBe(true);
    expect(quoteDelivery(input({ group: perKg, weightGrams }))).toEqual(UNRESOLVED);
  });

  it.each<[string, Partial<WilayaRateRow>, Partial<CommuneRateRow> | null]>([
    ['a negative wilaya base', { baseHome: -300 }, null],
    ['a negative wilaya override', { overrideHome: -1 }, null],
    ['a fractional wilaya price', { baseHome: 600.5 }, null],
    ['a negative commune price', {}, { baseHome: -300 }],
  ])('answers unresolved for %s, never a fee that lowers the order total', (_label, rateFields, communeFields) => {
    // Arrange
    const rate = { ...WILAYA, ...rateFields };
    const communeRate = communeFields === null ? null : commune(communeFields);

    // Act and Assert
    expect(quoteDelivery(input({ rate, communeRate }))).toEqual(UNRESOLVED);
  });

  it.each([Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY, Number.NaN, -1, 1.5])(
    'answers unresolved for a weight of %s grams, never a wrong total',
    (weightGrams) => {
      expect(quoteDelivery(input({ group: OVERWEIGHT, weightGrams }))).toEqual(UNRESOLVED);
    },
  );
});

describe('quoteDelivery: free delivery', () => {
  it('waives base and overweight: the buyer pays 0 and the quote says what was waived', () => {
    // Act
    const quote = quoteDelivery(input({ group: OVERWEIGHT, weightGrams: 7000, waive: true }));

    // Assert
    expect(quote).toEqual({
      baseFee: 600,
      overweightFee: 100,
      totalFee: 0,
      resolved: true,
      speed: 'standard',
      offeredSpeeds: ['standard'],
      freeShipping: true,
      waivedFee: 700,
      source: 'wilaya',
    });
  });

  it('waives nothing on an unresolved delivery', () => {
    expect(quoteDelivery(input({ rate: null, waive: true }))).toEqual(UNRESOLVED);
  });
});
