import { describe, expect, it } from 'vitest';
import { GeoCatalog, narrowTown } from '../../domain/geo-catalog';
import type { GeoSeed, TownSeed } from '../../domain/geo-seed';

const town = (codeOns: number, provinceCode: '01' | '16', flags: Partial<TownSeed> = {}): TownSeed => ({
  codeOns,
  provinceCode,
  name: `Town ${String(codeOns)}`,
  arabicName: `بلدية ${String(codeOns)}`,
  names: [],
  isStopdesk: true,
  isHomeDelivery: true,
  ...flags,
});

const REFERENCE: GeoSeed = {
  provinces: [
    { code: '16', name: 'Alger', arabicName: 'الجزائر', names: ['Algiers'] },
    { code: '01', name: 'Adrar', arabicName: 'أدرار', names: [] },
  ],
  towns: [town(1652, '16'), town(1601, '16', { isStopdesk: false }), town(101, '01')],
};

describe('GeoCatalog', () => {
  it('lists the wilayas by code, without their communes, with the code as id', () => {
    // Act
    const provinces = new GeoCatalog(REFERENCE).list();

    // Assert
    expect(provinces).toEqual([
      { id: '01', code: '01', name: 'Adrar', arabicName: 'أدرار', names: [] },
      { id: '16', code: '16', name: 'Alger', arabicName: 'الجزائر', names: ['Algiers'] },
    ]);
  });

  it('answers a wilaya with its communes ordered by ONS code, each with its stringified code as id', () => {
    // Act
    const province = new GeoCatalog(REFERENCE).withTowns('16');

    // Assert
    expect(province?.towns?.map((each) => each.id)).toEqual(['1601', '1652']);
    expect(province?.towns?.[0]).toEqual({ id: '1601', ...town(1601, '16', { isStopdesk: false }) });
  });

  it('answers undefined for a wilaya the reference data does not hold', () => {
    // Act and Assert
    expect(new GeoCatalog(REFERENCE).withTowns('02')).toBeUndefined();
  });
});

describe('narrowTown', () => {
  const base = { id: '1601', ...town(1601, '16') };

  it('leaves the reference flags when the store does not narrow the wilaya', () => {
    // Act and Assert
    expect(narrowTown(base, null)).toEqual(base);
  });

  it('ANDs the reference flags with the wilaya modes of the store', () => {
    // Act
    const narrowed = narrowTown(base, { home: true, desk: false, towns: new Map() });

    // Assert
    expect(narrowed).toMatchObject({ isHomeDelivery: true, isStopdesk: false });
  });

  it('uses the commune modes when the commune differs from its wilaya', () => {
    // Act
    const narrowed = narrowTown(base, {
      home: false,
      desk: false,
      towns: new Map([[1601, { home: true, desk: true }]]),
    });

    // Assert
    expect(narrowed).toMatchObject({ isHomeDelivery: true, isStopdesk: true });
  });

  it('never offers a mode the reference data does not offer', () => {
    // Arrange
    const noDesk = { ...base, isStopdesk: false };

    // Act
    const narrowed = narrowTown(noDesk, { home: true, desk: true, towns: new Map() });

    // Assert
    expect(narrowed.isStopdesk).toBe(false);
  });
});
