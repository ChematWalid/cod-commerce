import { FEE_GROUP_NAME_MAX, type WilayaCode } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  type AdjustForm,
  adjustmentInputOf,
  communePricesInputOf,
  copyNameOf,
  INITIAL_ADJUST_FORM,
  selectionStateOf,
  withAllSelected,
  withSelected,
} from '../../dashboard/model/price-tools';

const form = (fields: Partial<AdjustForm> = {}): AdjustForm => ({ ...INITIAL_ADJUST_FORM, value: '10', ...fields });
const selected = new Set<WilayaCode>(['16', '31']);

describe('the Raise/lower dialog input', () => {
  it('starts as a DZD raise of the home price, communes left out', () => {
    expect(INITIAL_ADJUST_FORM).toEqual({
      direction: 'raise',
      kind: 'amount',
      value: '',
      home: true,
      desk: false,
      includeCommunes: false,
    });
  });

  it('sends a raise as a positive value and a lower as a negative one, for the selected wilayas', () => {
    // Act
    const raise = adjustmentInputOf(form({ kind: 'percent' }), selected);
    const lower = adjustmentInputOf(form({ direction: 'lower', value: ' 150 ', desk: true }), selected);

    // Assert
    expect(raise).toEqual({
      ok: true,
      input: {
        provinceCodes: ['16', '31'],
        kind: 'percent',
        value: 10,
        home: true,
        desk: false,
        includeCommunes: false,
      },
    });
    expect(lower).toMatchObject({ ok: true, input: { kind: 'amount', value: -150, home: true, desk: true } });
  });

  it.each([
    ['a blank value', form({ value: '' })],
    ['a signed value (the direction holds the sign)', form({ value: '-10' })],
    ['a fractional value', form({ value: '2.5' })],
    ['neither price', form({ home: false, desk: false })],
    ['a cut of more than 100 %', form({ direction: 'lower', kind: 'percent', value: '101' })],
  ])('refuses %s without a request', (_label, input) => {
    expect(adjustmentInputOf(input, selected)).toEqual({ ok: false });
  });

  it('refuses an empty selection', () => {
    expect(adjustmentInputOf(form(), new Set())).toEqual({ ok: false });
  });
});

describe('the wilaya selection', () => {
  const codes: readonly WilayaCode[] = ['01', '16', '31'];

  it('ticks and unticks one wilaya without changing the others', () => {
    // Act
    const ticked = withSelected(new Set<WilayaCode>(['01']), '16', true);
    const unticked = withSelected(ticked, '01', false);

    // Assert
    expect([...ticked]).toEqual(['01', '16']);
    expect([...unticked]).toEqual(['16']);
  });

  it('selects every row of the table, or none', () => {
    expect([...withAllSelected(codes, true)]).toEqual(codes);
    expect([...withAllSelected(codes, false)]).toEqual([]);
  });

  it('says whether none, some or all rows are selected', () => {
    expect(selectionStateOf(new Set(), codes)).toBe('none');
    expect(selectionStateOf(new Set<WilayaCode>(['16']), codes)).toBe('some');
    expect(selectionStateOf(new Set(codes), codes)).toBe('all');
  });
});

describe('the Set price for all communes input', () => {
  it('sends only the typed prices', () => {
    expect(communePricesInputOf('16', { home: '450', desk: ' ' })).toEqual({
      ok: true,
      input: { provinceCode: '16', prices: { homePrice: 450 } },
    });
  });

  it.each([
    ['no price', { home: '', desk: '' }],
    ['a fractional price', { home: '4.5', desk: '' }],
    ['a negative price', { home: '', desk: '-1' }],
  ])('refuses %s without a request', (_label, prices) => {
    expect(communePricesInputOf('16', prices)).toEqual({ ok: false });
  });
});

describe('the name of a copy', () => {
  it('is the translated pattern around the source name', () => {
    expect(copyNameOf('Standard', (name) => `Copy of ${name}`)).toBe('Copy of Standard');
  });

  it('is cut to the longest name the contract allows (UTF-16 units), never inside a character', () => {
    // Act
    const name = copyNameOf('😀'.repeat(FEE_GROUP_NAME_MAX), (source) => `Copy ${source}`);

    // Assert
    expect(name.length).toBeLessThanOrEqual(FEE_GROUP_NAME_MAX);
    expect(name.length).toBeGreaterThanOrEqual(FEE_GROUP_NAME_MAX - 1);
    expect(name.endsWith('😀')).toBe(true);
  });
});
