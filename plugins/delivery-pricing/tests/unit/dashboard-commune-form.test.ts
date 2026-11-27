import { describe, expect, it } from 'vitest';
import {
  communeInputOf,
  communeOverridden,
  communePanelOf,
  communeRowsOf,
  communesSwitchedOn,
  effectiveSwitchOf,
  fallbackPriceOf,
  withCommune,
  withCommuneReset,
} from '../../dashboard/model/commune-form';
import { townNameOf, wilayaNameOf } from '../../dashboard/model/place-names';
import { findPlatformDefaultId } from '../../dashboard/model/template';
import { communeRateOf, townOf } from '../support/dashboard-fixtures';

describe('commune rows of a wilaya (D3125)', () => {
  it('lists every commune of the wilaya, with the override typed only where one is stored', () => {
    // Arrange
    const towns = [townOf(1601, '16'), townOf(1602, '16'), townOf(1603, '16', false)];
    const stored = [
      communeRateOf(1601, '16', { homePrice: 550, baseHomePrice: 500, deskPrice: 300, baseDeskPrice: 300 }),
      communeRateOf(1602, '16', { homePrice: 620, overridden: true, deliveryEnabled: false }),
    ];

    // Act
    const rows = communeRowsOf(towns, stored);

    // Assert
    expect(rows.map((row) => row.codeOns)).toEqual([1601, 1602, 1603]);
    expect(rows[0]).toMatchObject({ homePrice: '550', deskPrice: '', baseHomePrice: 500, baseDeskPrice: 300 });
    expect(rows[1]).toMatchObject({ homePrice: '620', deliveryEnabled: false });
    expect(rows[2]).toMatchObject({ homePrice: '', deliveryEnabled: null, isStopdesk: false });
    expect(rows.map(communeOverridden)).toEqual([true, true, false]);
  });

  it('falls back to the commune base, then the wilaya, and inherits a switch the commune leaves unset', () => {
    // Act
    const fallbacks = [fallbackPriceOf(500, '700'), fallbackPriceOf(null, '700')];
    const switches = [effectiveSwitchOf(null, true), effectiveSwitchOf(false, true), effectiveSwitchOf(true, false)];

    // Assert
    expect(fallbacks).toEqual(['500', '700']);
    expect(switches).toEqual([true, false, true]);
  });

  it('edits one commune and resets it to inherit everything', () => {
    // Arrange
    const rows = communeRowsOf([townOf(1601, '16'), townOf(1602, '16')], []);

    // Act
    const edited = withCommune(rows, 1602, { homePrice: '900', deskEnabled: false });
    const reset = withCommuneReset(edited, 1602);

    // Assert
    expect(edited[1]).toMatchObject({ homePrice: '900', deskEnabled: false });
    expect(edited[0]).toEqual(rows[0]);
    expect(reset.map(communeOverridden)).toEqual([false, false]);
  });

  it('sends every commune, a blank price as null (cleared), and names a broken price', () => {
    // Arrange
    const rows = withCommune(communeRowsOf([townOf(1601, '16'), townOf(1602, '16')], []), 1601, {
      homePrice: ' 650 ',
      deliveryEnabled: true,
    });

    // Act
    const submit = communeInputOf('16', rows);
    const broken = communeInputOf('16', withCommune(rows, 1602, { deskPrice: '-3' }));

    // Assert
    expect(submit).toEqual({
      ok: true,
      input: {
        provinceCode: '16',
        rows: [
          { codeOns: 1601, homePrice: 650, deskPrice: null, deliveryEnabled: true, deskEnabled: null },
          { codeOns: 1602, homePrice: null, deskPrice: null, deliveryEnabled: null, deskEnabled: null },
        ],
      },
    });
    expect(broken).toEqual({ ok: false, errors: new Set([1602]) });
  });

  it('counts the communes of a wilaya explicitly switched on, for the warning when the wilaya goes off', () => {
    // Arrange
    const stored = [
      communeRateOf(1601, '16', { deliveryEnabled: true }),
      communeRateOf(1602, '16', { deliveryEnabled: false }),
      communeRateOf(1603, '16'),
      communeRateOf(3101, '31', { deliveryEnabled: true }),
    ];

    // Act
    const count = communesSwitchedOn(stored, '16');

    // Assert
    expect(count).toBe(1);
  });

  it('asks a new pricing option to be saved first, since commune prices need its id', () => {
    // Act
    const states = [communePanelOf(null), communePanelOf('1001')];

    // Assert
    expect(states).toEqual(['save-first', 'editable']);
  });
});

describe('the template of a new pricing option', () => {
  it('pages through the list until it finds the platform default table', async () => {
    // Arrange
    const pages = [
      { items: [{ id: '3', isPlatformDefault: false }], totalItems: 2 },
      { items: [{ id: '1', isPlatformDefault: true }], totalItems: 2 },
    ];
    const asked: number[] = [];

    // Act
    const id = await findPlatformDefaultId((skip) => {
      asked.push(skip);
      return Promise.resolve(pages[skip] ?? { items: [], totalItems: 2 });
    }, 1);

    // Assert
    expect(id).toBe('1');
    expect(asked).toEqual([0, 1]);
  });

  it('answers null when no page holds it, stopping on an empty page', async () => {
    // Act
    const id = await findPlatformDefaultId(() => Promise.resolve({ items: [], totalItems: 5 }), 1);

    // Assert
    expect(id).toBeNull();
  });
});

describe('place names in the UI language', () => {
  it('shows the Arabic name in Arabic and the Latin name otherwise', () => {
    // Arrange
    const town = { name: 'Bab El Oued', arabicName: 'باب الوادي' };

    // Act
    const names = [
      wilayaNameOf('16', 'ar'),
      wilayaNameOf('16', 'en-US'),
      townNameOf(town, 'ar'),
      townNameOf(town, 'en'),
    ];

    // Assert
    expect(names).toEqual(['الجزائر', 'Alger', 'باب الوادي', 'Bab El Oued']);
  });
});
