import { describe, expect, it } from 'vitest';
import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';
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
