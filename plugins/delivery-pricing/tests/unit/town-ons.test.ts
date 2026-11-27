import { describe, expect, it } from 'vitest';
import { townOnsOf } from '../../domain/town-ons';

describe('townOnsOf: the offers destination commune (D3125)', () => {
  it('reads no commune when none is sent', () => {
    expect(townOnsOf(undefined)).toEqual({ ok: true, codeOns: undefined });
  });

  it.each([
    ['1', 1],
    ['101', 101],
    ['1601', 1601],
    ['999999', 999_999],
  ])('reads %s as the ONS code %s', (raw, codeOns) => {
    expect(townOnsOf(raw)).toEqual({ ok: true, codeOns });
  });

  it.each([
    '',
    ' ',
    '0',
    '01',
    '0101',
    '1000000',
    '16 01',
    ' 1601',
    '1601 ',
    '16.01',
    '1e3',
    '-16',
    '+16',
    'abc',
    '١٦٠١',
  ])('refuses %j, so a bad commune never falls back to the wilaya price', (raw) => {
    expect(townOnsOf(raw)).toEqual({ ok: false });
  });
});
