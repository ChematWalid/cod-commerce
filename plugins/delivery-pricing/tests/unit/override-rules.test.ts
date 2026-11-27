import { WILAYA_CODES, type DeliveryFeeRateInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';
import { communeOverrideOf, mergeCommuneRow, wilayaOverrideOf, wilayaRowsOf } from '../../domain/override-rules';

const stored = (fields: Partial<CommuneRateRow> = {}): CommuneRateRow => ({
  codeOns: 1601,
  provinceCode: '16',
  baseHome: null,
  baseDesk: null,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: null,
  deskEnabled: null,
  ...fields,
});

const typed = (fields: Partial<{ homePrice: number | null; deskPrice: number | null }> = {}) => ({
  codeOns: 1601,
  homePrice: null,
  deskPrice: null,
  deliveryEnabled: null,
  deskEnabled: null,
  ...fields,
});

describe('the wilaya override rule (D3107)', () => {
  it('stores no override for a price equal to the base', () => {
    expect(wilayaOverrideOf(500, 500)).toBeNull();
  });

  it('stores the typed price as the override when it differs', () => {
    expect(wilayaOverrideOf(500, 650)).toBe(650);
    expect(wilayaOverrideOf(500, 0)).toBe(0);
  });

  it("builds the merchant's wilaya rows over each wilaya's base, keeping the switches", () => {
    // Arrange
    const rates: DeliveryFeeRateInput[] = WILAYA_CODES.map((provinceCode) => ({
      provinceCode,
      homePrice: provinceCode === '16' ? 700 : 500,
      deskPrice: 400,
      deliveryEnabled: provinceCode !== '01',
      deskEnabled: false,
    }));

    // Act
    const rows = wilayaRowsOf(rates, () => ({ home: 500, desk: 400 }));

    // Assert
    expect(rows).toHaveLength(WILAYA_CODES.length);
    expect(rows.find((row) => row.provinceCode === '16')).toEqual<WilayaRateRow>({
      provinceCode: '16',
      baseHome: 500,
      baseDesk: 400,
      overrideHome: 700,
      overrideDesk: null,
      deliveryEnabled: true,
      deskEnabled: false,
    });
    expect(rows.find((row) => row.provinceCode === '01')?.deliveryEnabled).toBe(false);
  });
});

describe('the commune override rule (D3125)', () => {
  it('compares a typed price with the commune base', () => {
    expect(communeOverrideOf(450, 450)).toBeNull();
    expect(communeOverrideOf(450, 500)).toBe(500);
  });

  it('reads any typed price as an override when the commune has no base', () => {
    expect(communeOverrideOf(null, 450)).toBe(450);
  });

  it('clears the override on an empty price, so the base then the wilaya apply', () => {
    expect(communeOverrideOf(450, null)).toBeNull();
    expect(communeOverrideOf(null, null)).toBeNull();
  });
});

describe('mergeCommuneRow', () => {
  it('writes the overrides and switches of a new commune', () => {
    // Act
    const row = mergeCommuneRow(undefined, '16', { ...typed({ homePrice: 450 }), deskEnabled: false });

    // Assert
    expect(row).toEqual(stored({ overrideHome: 450, deskEnabled: false }));
  });

  it('never writes the base prices, and keeps them', () => {
    // Act
    const row = mergeCommuneRow(stored({ baseHome: 450, baseDesk: 300 }), '16', typed({ homePrice: 450 }));

    // Assert
    expect(row).toEqual(stored({ baseHome: 450, baseDesk: 300 }));
  });

  it('answers null when overrides, switches and bases are all empty (the row is deleted)', () => {
    expect(mergeCommuneRow(stored({ overrideHome: 500 }), '16', typed())).toBeNull();
  });

  it('keeps a row that still holds a base after a reset', () => {
    expect(mergeCommuneRow(stored({ baseDesk: 300, overrideDesk: 350 }), '16', typed())).toEqual(
      stored({ baseDesk: 300 }),
    );
  });
});
