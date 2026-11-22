import { MAX_DELIVERY_PRICE, type WilayaCode } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type CarrierRate, carrierRatesProblem, mergeCarrierPrices } from '../../domain/carrier-prices';
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

const wilayaRate = (provinceCode: WilayaCode, home: number, desk: number): CarrierRate => ({
  provinceCode,
  codeOns: null,
  home,
  desk,
});

const communeRate = (codeOns: number, home: number, desk: number): CarrierRate => ({
  provinceCode: '16',
  codeOns,
  home,
  desk,
});

describe('mergeCarrierPrices at wilaya level (D3107)', () => {
  it("updates the wilaya's base prices from the carrier", () => {
    // Arrange
    const rows = [wilaya('16')];

    // Act
    const merged = mergeCarrierPrices(rows, [], [wilayaRate('16', 550, 450)]);

    // Assert
    expect(merged.rates).toEqual([wilaya('16', { baseHome: 550, baseDesk: 450 })]);
  });

  it("keeps the merchant's override and the switches when the base moves", () => {
    // Arrange
    const rows = [wilaya('16', { overrideHome: 650, overrideDesk: 300, deliveryEnabled: false, deskEnabled: false })];

    // Act
    const [row] = mergeCarrierPrices(rows, [], [wilayaRate('16', 550, 450)]).rates;

    // Assert
    expect(row).toEqual({
      provinceCode: '16',
      baseHome: 550,
      baseDesk: 450,
      overrideHome: 650,
      overrideDesk: 300,
      deliveryEnabled: false,
      deskEnabled: false,
    });
  });

  it('keeps an override even when the new base equals it', () => {
    // Arrange
    const rows = [wilaya('16', { overrideHome: 650 })];

    // Act
    const [row] = mergeCarrierPrices(rows, [], [wilayaRate('16', 650, 400)]).rates;

    // Assert
    expect(row?.overrideHome).toBe(650);
    expect(row?.baseHome).toBe(650);
  });

  it('keeps the base of a wilaya the carrier lacks', () => {
    // Arrange
    const rows = [wilaya('16'), wilaya('31', { baseHome: 450, baseDesk: 250 })];

    // Act
    const merged = mergeCarrierPrices(rows, [], [wilayaRate('16', 550, 450)]);

    // Assert
    expect(merged.rates[1]).toEqual(wilaya('31', { baseHome: 450, baseDesk: 250 }));
  });

  it('adds no wilaya row for a carrier rate of a wilaya the group has no row for', () => {
    // Arrange
    const rows = [wilaya('16')];

    // Act
    const merged = mergeCarrierPrices(rows, [], [wilayaRate('31', 450, 250)]);

    // Assert
    expect(merged.rates).toEqual([wilaya('16')]);
  });
});

describe('mergeCarrierPrices at commune level (D3125)', () => {
  it("updates a stored commune's base and keeps its overrides and switches", () => {
    // Arrange
    const stored = [commune(1601, { baseHome: 300, overrideHome: 450, deliveryEnabled: true, deskEnabled: false })];

    // Act
    const merged = mergeCarrierPrices([wilaya('16')], stored, [communeRate(1601, 350, 250)]);

    // Assert
    expect(merged.communeUpserts).toEqual([
      commune(1601, { baseHome: 350, baseDesk: 250, overrideHome: 450, deliveryEnabled: true, deskEnabled: false }),
    ]);
  });

  it('adds a base-only row for a commune the carrier bills and the group has no row for', () => {
    // Act
    const merged = mergeCarrierPrices([wilaya('16')], [], [communeRate(1652, 600, 350)]);

    // Assert
    expect(merged.communeUpserts).toEqual([commune(1652, { baseHome: 600, baseDesk: 350 })]);
  });

  it('leaves a commune the carrier lacks untouched', () => {
    // Arrange
    const stored = [commune(1601, { baseHome: 300, baseDesk: 200 }), commune(1652, { overrideHome: 700 })];

    // Act
    const merged = mergeCarrierPrices([wilaya('16')], stored, [communeRate(1601, 350, 250)]);

    // Assert
    expect(merged.communeUpserts.map((row) => row.codeOns)).toEqual([1601]);
  });

  it('writes no commune whose base is already the carrier price', () => {
    // Arrange
    const stored = [commune(1601, { baseHome: 350, baseDesk: 250, overrideDesk: 100 })];

    // Act
    const merged = mergeCarrierPrices([wilaya('16')], stored, [communeRate(1601, 350, 250)]);

    // Assert
    expect(merged.communeUpserts).toEqual([]);
  });

  it('never moves a wilaya base from a commune rate', () => {
    // Act
    const merged = mergeCarrierPrices([wilaya('16')], [], [communeRate(1601, 900, 900)]);

    // Assert
    expect(merged.rates).toEqual([wilaya('16')]);
  });
});

describe('carrierRatesProblem', () => {
  it('accepts whole prices from 0 to the maximum', () => {
    expect(carrierRatesProblem([wilayaRate('16', 0, MAX_DELIVERY_PRICE), communeRate(1601, 350, 250)])).toBeNull();
  });

  it.each([
    ['a negative price', wilayaRate('16', -1, 400)],
    ['a fractional price', wilayaRate('16', 500.5, 400)],
    ['a price above the maximum', wilayaRate('16', 500, MAX_DELIVERY_PRICE + 1)],
    ['an unknown wilaya', { provinceCode: '99' as WilayaCode, codeOns: null, home: 500, desk: 400 }],
    ['a malformed commune code', communeRate(0, 350, 250)],
  ])('refuses %s', (_label, rate) => {
    expect(carrierRatesProblem([rate])).not.toBeNull();
  });

  it('refuses a wilaya or a commune named twice', () => {
    expect(carrierRatesProblem([wilayaRate('16', 500, 400), wilayaRate('16', 550, 400)])).not.toBeNull();
    expect(carrierRatesProblem([communeRate(1601, 350, 250), communeRate(1601, 360, 250)])).not.toBeNull();
  });
});
