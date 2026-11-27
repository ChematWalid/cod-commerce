import { MONEY_MAX_DZD } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';
import { isQuotablePrice, quoteDelivery } from '../../domain/quote';
import { modesOf, NOTHING_OFFERED, storeModesOf } from '../../domain/store-modes';

const wilaya = (deliveryEnabled: boolean, deskEnabled: boolean): WilayaRateRow => ({
  provinceCode: '16',
  baseHome: 600,
  baseDesk: 400,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled,
  deskEnabled,
});

const commune = (
  codeOns: number,
  deliveryEnabled: boolean | null,
  deskEnabled: boolean | null,
  homePrice: number | null = null,
): CommuneRateRow => ({
  codeOns,
  provinceCode: '16',
  baseHome: null,
  baseDesk: null,
  overrideHome: homePrice,
  overrideDesk: null,
  deliveryEnabled,
  deskEnabled,
});

describe('modesOf (D3125 switches)', () => {
  /** One row of the switch table: wilaya delivery/desk, commune delivery/desk, then the expected home/desk. */
  type SwitchCase = readonly [boolean, boolean, boolean | null, boolean | null, boolean, boolean];
  const cases: readonly SwitchCase[] = [
    [true, true, null, null, true, true],
    [true, false, null, null, true, false],
    [false, true, null, null, false, false],
    [false, false, null, null, false, false],
    [false, false, true, null, true, false],
    [false, true, true, null, true, true],
    [true, true, false, null, false, false],
    [true, true, false, true, false, false],
    [true, true, null, false, true, false],
    [true, false, null, true, true, true],
    [false, false, true, true, true, true],
  ];

  it.each(cases)('wilaya delivery %s desk %s, commune delivery %s desk %s → home %s desk %s', (...row) => {
    // Arrange
    const [wilayaDelivery, wilayaDesk, communeDelivery, communeDesk, home, desk] = row;
    const communeRow = commune(1601, communeDelivery, communeDesk);

    // Act
    const modes = modesOf(wilaya(wilayaDelivery, wilayaDesk), communeRow);

    // Assert
    expect(modes).toEqual({ home, desk });
  });

  it("answers the wilaya's own modes without a commune row: desk needs delivery", () => {
    // Act and Assert
    expect(modesOf(wilaya(true, true), null)).toEqual({ home: true, desk: true });
    expect(modesOf(wilaya(false, true), null)).toEqual({ home: false, desk: false });
  });
});

describe('storeModesOf', () => {
  it('offers nothing in a wilaya the group has no row for, whatever its commune rows say', () => {
    // Act
    const modes = storeModesOf(null, [commune(1601, true, true)]);

    // Assert
    expect(modes).toEqual(NOTHING_OFFERED);
  });

  it('keeps only the communes whose modes differ from the wilaya', () => {
    // Arrange
    const rows = [commune(1601, false, null), commune(1652, null, null, 750), commune(1603, true, true)];

    // Act
    const modes = storeModesOf(wilaya(true, false), rows);

    // Assert
    expect(modes.home).toBe(true);
    expect(modes.desk).toBe(false);
    expect([...modes.towns.entries()]).toEqual([
      [1601, { home: false, desk: false }],
      [1603, { home: true, desk: true }],
    ]);
  });

  it('opens a commune explicitly switched on inside a wilaya that is off', () => {
    // Act
    const modes = storeModesOf(wilaya(false, false), [commune(1601, true, null)]);

    // Assert
    expect(modes).toMatchObject({ home: false, desk: false });
    expect(modes.towns.get(1601)).toEqual({ home: true, desk: false });
  });
});

describe('storeModesOf offers only the modes the quote can price (#294)', () => {
  const UNPRICEABLE: readonly number[] = [-300, 1.5, MONEY_MAX_DZD + 1];

  it.each(UNPRICEABLE)('refuses a stored price of %s, as the quote does', (price) => {
    // Act and Assert
    expect(isQuotablePrice(price)).toBe(false);
  });

  it.each([0, 600, MONEY_MAX_DZD])('accepts a stored price of %s', (price) => {
    // Act and Assert
    expect(isQuotablePrice(price)).toBe(true);
  });

  it.each(UNPRICEABLE)('does not offer home in a wilaya whose home price is %s, agreeing with the quote', (price) => {
    // Arrange
    const row: WilayaRateRow = { ...wilaya(true, true), baseHome: price };
    const group = { chargeOverweight: false, overweightAllowanceKg: 5, overweightRate: 50 };
    const quoteInput = { group, rate: row, communeRate: null, town: null, weightGrams: 0, waive: false };

    // Act
    const modes = storeModesOf(row, []);
    const homeQuote = quoteDelivery({ ...quoteInput, method: 'home' });
    const deskQuote = quoteDelivery({ ...quoteInput, method: 'desk' });

    // Assert
    expect(modes).toMatchObject({ home: false, desk: true });
    expect(homeQuote.resolved).toBe(false);
    expect(deskQuote.resolved).toBe(true);
  });

  it.each(UNPRICEABLE)('does not offer desk in a commune whose desk price is %s', (price) => {
    // Arrange
    const row: CommuneRateRow = { ...commune(1601, null, null), overrideDesk: price };

    // Act
    const modes = storeModesOf(wilaya(true, true), [row]);

    // Assert
    expect(modes).toMatchObject({ home: true, desk: true });
    expect(modes.towns.get(1601)).toEqual({ home: true, desk: false });
  });

  it('offers a commune with its own valid price inside a wilaya whose price is unpriceable', () => {
    // Arrange
    const row: WilayaRateRow = { ...wilaya(true, true), baseHome: -300 };

    // Act
    const modes = storeModesOf(row, [commune(1601, null, null, 750)]);

    // Assert
    expect(modes.home).toBe(false);
    expect(modes.towns.get(1601)).toEqual({ home: true, desk: true });
  });

  it('keeps a valid row unchanged', () => {
    // Act and Assert
    expect(storeModesOf(wilaya(true, true), [])).toEqual({ home: true, desk: true, towns: new Map() });
  });
});
