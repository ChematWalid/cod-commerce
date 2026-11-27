import { describe, expect, it } from 'vitest';
import type { CommuneRateRow, WilayaRateRow } from '../../domain/fee-group';
import { communeRateView, wilayaRateView } from '../../domain/rate-view';

const wilaya = (fields: Partial<WilayaRateRow> = {}): WilayaRateRow => ({
  provinceCode: '16',
  baseHome: 500,
  baseDesk: 400,
  overrideHome: null,
  overrideDesk: null,
  deliveryEnabled: true,
  deskEnabled: true,
  ...fields,
});

const commune = (fields: Partial<CommuneRateRow> = {}): CommuneRateRow => ({
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

describe('wilayaRateView', () => {
  it('answers the base prices and not overridden without an override', () => {
    expect(wilayaRateView(wilaya())).toEqual({
      provinceCode: '16',
      homePrice: 500,
      deskPrice: 400,
      baseHomePrice: 500,
      baseDeskPrice: 400,
      deliveryEnabled: true,
      deskEnabled: true,
      overridden: false,
    });
  });

  it('answers the override as the price and overridden, even when it equals a later base (D3125)', () => {
    // Act
    const view = wilayaRateView(wilaya({ baseHome: 650, overrideHome: 650 }));

    // Assert
    expect(view).toMatchObject({ homePrice: 650, baseHomePrice: 650, overridden: true });
  });
});

describe('communeRateView', () => {
  it('answers null prices and switches that inherit the wilaya', () => {
    expect(communeRateView(commune({ deskEnabled: false }))).toEqual({
      codeOns: 1601,
      provinceCode: '16',
      homePrice: null,
      deskPrice: null,
      baseHomePrice: null,
      baseDeskPrice: null,
      deliveryEnabled: null,
      deskEnabled: false,
      overridden: false,
    });
  });

  it('answers override ?? base as the price', () => {
    // Act
    const view = communeRateView(commune({ baseHome: 450, baseDesk: 300, overrideDesk: 350 }));

    // Assert
    expect(view).toMatchObject({ homePrice: 450, deskPrice: 350, overridden: true });
  });
});
