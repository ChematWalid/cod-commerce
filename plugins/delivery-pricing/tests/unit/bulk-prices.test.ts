import { MAX_DELIVERY_PRICE, type WilayaCode } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  adjustCommunePrices,
  adjustedPrice,
  adjustPrices,
  type PriceChange,
  setCommunePrices,
} from '../../domain/bulk-prices';
import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';

const wilaya = (provinceCode: WilayaCode, fields: Partial<WilayaRateRow> = {}): WilayaRateRow => ({
  provinceCode,
  baseHome: 500,
  baseDesk: 400,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: true,
  deskEnabled: true,
  ...fields,
});

const commune = (codeOns: number, fields: Partial<CommuneRateRow> = {}): CommuneRateRow => ({
  codeOns,
  provinceCode: '16',
  baseHome: null,
  baseDesk: null,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: null,
  deskEnabled: null,
  ...fields,
});

const change = (fields: Partial<PriceChange> = {}): PriceChange => ({
  kind: 'amount',
  value: 100,
  home: true,
  desk: false,
  ...fields,
});

describe('adjustedPrice', () => {
  it.each([
    ['adds a DZD amount', 500, change({ value: 150 }), 650],
    ['subtracts a DZD amount', 500, change({ value: -150 }), 350],
    ['raises by a percent', 500, change({ kind: 'percent', value: 10 }), 550],
    ['rounds a half DZD up (4,950 - 15 % = 4,207.5)', 4950, change({ kind: 'percent', value: -15 }), 4208],
    ['rounds below a half down (744 + 10 % = 818.4)', 744, change({ kind: 'percent', value: 10 }), 818],
    ['rounds a half up on a raise (745 + 10 % = 819.5)', 745, change({ kind: 'percent', value: 10 }), 820],
    ['clamps a cut below zero to 0', 300, change({ value: -500 }), 0],
    ['brings a price to 0 at -100 %', 300, change({ kind: 'percent', value: -100 }), 0],
    ['clamps a raise to the price bound', MAX_DELIVERY_PRICE - 10, change({ value: 500 }), MAX_DELIVERY_PRICE],
    ['clamps a percent raise to the price bound', 50_000, change({ kind: 'percent', value: 1000 }), MAX_DELIVERY_PRICE],
  ])('%s', (_label, price, adjustment, expected) => {
    expect(adjustedPrice(price, adjustment)).toBe(expected);
  });
});

describe('adjustPrices', () => {
  it('moves the effective home price of the selected wilayas only, as an override over the kept base', () => {
    // Arrange
    const rows = [wilaya('16'), wilaya('31', { overrideHome: 600 }), wilaya('01')];

    // Act
    const adjusted = adjustPrices(rows, new Set<WilayaCode>(['16', '31']), change({ value: 50 }));

    // Assert
    expect(adjusted).toEqual([wilaya('16', { overrideHome: 550 }), wilaya('31', { overrideHome: 650 })]);
  });

  it('changes the desk price only when asked, and both when asked', () => {
    // Arrange
    const rows = [wilaya('16')];

    // Act
    const deskOnly = adjustPrices(rows, new Set<WilayaCode>(['16']), change({ home: false, desk: true }));
    const both = adjustPrices(rows, new Set<WilayaCode>(['16']), change({ home: true, desk: true }));

    // Assert
    expect(deskOnly).toEqual([wilaya('16', { overrideDesk: 500 })]);
    expect(both).toEqual([wilaya('16', { overrideHome: 600, overrideDesk: 500 })]);
  });

  it('stores no override when the new price lands on the base (D3107), and never writes the base', () => {
    // Arrange
    const rows = [wilaya('16', { overrideHome: 400 })];

    // Act
    const adjusted = adjustPrices(rows, new Set<WilayaCode>(['16']), change({ value: 100 }));

    // Assert
    expect(adjusted).toEqual([wilaya('16', { overrideHome: null })]);
  });

  it('keeps the switches and the untouched override of each row', () => {
    // Arrange
    const rows = [wilaya('16', { overrideDesk: 350, deliveryEnabled: false, deskEnabled: false })];

    // Act
    const [row] = adjustPrices(rows, new Set<WilayaCode>(['16']), change());

    // Assert
    expect(row).toEqual(
      wilaya('16', { overrideHome: 600, overrideDesk: 350, deliveryEnabled: false, deskEnabled: false }),
    );
  });

  it('answers no row for a selected wilaya whose prices the change leaves as they are', () => {
    // Arrange
    const rows = [wilaya('16', { overrideHome: 0 }), wilaya('31')];

    // Act
    const adjusted = adjustPrices(rows, new Set<WilayaCode>(['16', '31']), change({ kind: 'percent', value: -10 }));

    // Assert
    expect(adjusted).toEqual([wilaya('31', { overrideHome: 450 })]);
  });

  it('answers no row for a selection the group does not hold', () => {
    expect(adjustPrices([wilaya('16')], new Set<WilayaCode>(['31']), change())).toEqual([]);
  });
});

describe('adjustCommunePrices', () => {
  it('moves the priced communes of the selected wilayas, leaving the inheriting ones and other wilayas alone', () => {
    // Arrange
    const rows = [
      commune(1601, { overrideHome: 450 }),
      commune(1652, { deliveryEnabled: false }),
      commune(3101, { provinceCode: '31', overrideHome: 300 }),
    ];

    // Act
    const adjusted = adjustCommunePrices(rows, new Set<WilayaCode>(['16']), change({ value: 50 }));

    // Assert
    expect(adjusted).toEqual([commune(1601, { overrideHome: 500 })]);
  });

  it('moves a commune base into an override and clears an override that lands on the base', () => {
    // Arrange
    const rows = [commune(1601, { baseHome: 400 }), commune(1652, { baseHome: 400, overrideHome: 300 })];

    // Act
    const adjusted = adjustCommunePrices(rows, new Set<WilayaCode>(['16']), change({ value: 100 }));

    // Assert
    expect(adjusted).toEqual([
      commune(1601, { baseHome: 400, overrideHome: 500 }),
      commune(1652, { baseHome: 400, overrideHome: null }),
    ]);
  });

  it('changes only the asked method of a commune', () => {
    // Arrange
    const rows = [commune(1601, { overrideHome: 450, overrideDesk: 250 })];

    // Act
    const adjusted = adjustCommunePrices(rows, new Set<WilayaCode>(['16']), change({ home: false, desk: true }));

    // Assert
    expect(adjusted).toEqual([commune(1601, { overrideHome: 450, overrideDesk: 350 })]);
  });
});

describe('setCommunePrices', () => {
  const towns = [1601, 1652, 1653];

  it('gives every commune of the wilaya the home price, keeping the desk and switches as stored', () => {
    // Arrange
    const stored = [commune(1652, { overrideDesk: 250, deskEnabled: false })];

    // Act
    const result = setCommunePrices(towns, '16', stored, { homePrice: 450 });

    // Assert
    expect(result).toEqual({
      upserts: [
        commune(1601, { overrideHome: 450 }),
        commune(1652, { overrideHome: 450, overrideDesk: 250, deskEnabled: false }),
        commune(1653, { overrideHome: 450 }),
      ],
      removals: [],
    });
  });

  it('stores no override where the price equals the commune base (D3125)', () => {
    // Arrange
    const stored = [commune(1601, { baseHome: 450, overrideHome: 500 })];

    // Act
    const { upserts } = setCommunePrices([1601], '16', stored, { homePrice: 450 });

    // Assert
    expect(upserts).toEqual([commune(1601, { baseHome: 450, overrideHome: null })]);
  });

  it('clears every override on null, removing the rows left empty and keeping the rest', () => {
    // Arrange
    const stored = [commune(1601, { overrideHome: 450 }), commune(1652, { overrideHome: 450, deliveryEnabled: true })];

    // Act
    const result = setCommunePrices(towns, '16', stored, { homePrice: null });

    // Assert
    expect(result).toEqual({ upserts: [commune(1652, { deliveryEnabled: true })], removals: [1601] });
  });

  it('writes nothing for a commune already at the asked price', () => {
    // Arrange
    const stored = [commune(1601, { overrideHome: 450, overrideDesk: 300 })];

    // Act
    const result = setCommunePrices([1601], '16', stored, { homePrice: 450, deskPrice: 300 });

    // Assert
    expect(result).toEqual({ upserts: [], removals: [] });
  });
});
