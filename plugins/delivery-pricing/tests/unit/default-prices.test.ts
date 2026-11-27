import { MAX_DELIVERY_PRICE, WILAYA_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICES, defaultRates } from '../../domain/default-prices';

describe('the platform default price table (D3124)', () => {
  it('holds exactly one entry for each wilaya code', () => {
    // Act
    const codes = Object.keys(DEFAULT_PRICES).sort();

    // Assert
    expect(codes).toEqual([...WILAYA_CODES].sort());
  });

  it('holds whole DZD prices within the delivery price bound', () => {
    // Act
    const prices = Object.values(DEFAULT_PRICES).flatMap(({ home, desk }) => [home, desk]);

    // Assert
    expect(prices.every((price) => Number.isInteger(price) && price > 0 && price <= MAX_DELIVERY_PRICE)).toBe(true);
  });

  it('copies the appendix values for Alger, Oran and an estimated 2026 wilaya', () => {
    expect(DEFAULT_PRICES['16']).toEqual({ home: 500, desk: 400 });
    expect(DEFAULT_PRICES['31']).toEqual({ home: 450, desk: 250 });
    expect(DEFAULT_PRICES['69']).toEqual({ home: 1000, desk: 550 });
  });

  it('builds one enabled row per wilaya with the default as base and no override', () => {
    // Act
    const rows = defaultRates();

    // Assert
    expect(rows.map((row) => row.provinceCode)).toEqual([...WILAYA_CODES]);
    expect(rows.find((row) => row.provinceCode === '16')).toEqual({
      provinceCode: '16',
      baseHome: 500,
      baseDesk: 400,
      overrideHome: null,
      overrideDesk: null,
      deliveryEnabled: true,
      deskEnabled: true,
    });
  });
});
