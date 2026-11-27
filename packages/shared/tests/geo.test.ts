import { describe, expect, it } from 'vitest';
import { WILAYA_COUNT, WILAYAS, parseWilayaCodeParam, provinceSchema, townSchema } from '../src/index';

/** Synthetic town in the data-model shape (data-model.md, `GET /provinces/code/:code`). */
const algiersCentre = {
  id: '1601',
  provinceCode: '16',
  name: 'Alger Centre',
  arabicName: 'الجزائر الوسطى',
  names: ['الجزائر الوسطى', 'Alger Centre'],
  codeOns: 1601,
  isStopdesk: true,
  isHomeDelivery: true,
};

const algiers = {
  id: '16',
  code: '16',
  name: 'Alger',
  arabicName: 'الجزائر',
  names: ['الجزائر'],
};

describe('townSchema', () => {
  it('parses a town in the data-model shape', () => {
    expect(townSchema.parse(algiersCentre)).toEqual(algiersCentre);
  });

  it('refuses a province code outside 01–69', () => {
    expect(townSchema.safeParse({ ...algiersCentre, provinceCode: '70' }).success).toBe(false);
  });

  it('refuses a non-integer ONS code', () => {
    expect(townSchema.safeParse({ ...algiersCentre, codeOns: 16.5 }).success).toBe(false);
    expect(townSchema.safeParse({ ...algiersCentre, codeOns: '1601' }).success).toBe(false);
  });
});

describe('provinceSchema', () => {
  it('parses a province without towns, as the list answers it', () => {
    expect(provinceSchema.parse(algiers)).toEqual(algiers);
  });

  it('parses a province with its towns, as the detail answers it', () => {
    const parsed = provinceSchema.parse({ ...algiers, towns: [algiersCentre] });

    expect(parsed.towns).toEqual([algiersCentre]);
  });

  it('refuses a one-digit province code', () => {
    expect(provinceSchema.safeParse({ ...algiers, code: '1' }).success).toBe(false);
  });
});

describe('parseWilayaCodeParam', () => {
  it.each([
    ['16', '16'],
    ['1', '01'],
    ['01', '01'],
    ['58', '58'],
    ['69', '69'],
  ])('reads %s as wilaya %s', (param, code) => {
    expect(parseWilayaCodeParam(param)).toBe(code);
  });

  it.each(['0', '00', '70', '1.5', 'abc', '016', '', ' 16', '+1', '-1', '1e1'])('refuses %j', (param) => {
    expect(parseWilayaCodeParam(param)).toBeNull();
  });
});

describe('WILAYAS', () => {
  it('names every wilaya', () => {
    expect(WILAYAS).toHaveLength(WILAYA_COUNT);
    expect(WILAYAS.filter((wilaya) => wilaya.names === null)).toEqual([]);
  });

  it('names Algiers Alger / الجزائر', () => {
    expect(WILAYAS.find((wilaya) => wilaya.code === '16')?.names).toEqual({ ar: 'الجزائر', fr: 'Alger' });
  });

  it('names the 2019 wilayas', () => {
    expect(WILAYAS.find((wilaya) => wilaya.code === '49')?.names).toEqual({ ar: 'تيميمون', fr: 'Timimoun' });
    expect(WILAYAS.find((wilaya) => wilaya.code === '58')?.names).toEqual({ ar: 'المنيعة', fr: 'El Meniaa' });
  });

  it('names the wilayas of law 26-06 as decree 26-206 does', () => {
    expect(WILAYAS.find((wilaya) => wilaya.code === '59')?.names).toEqual({ ar: 'أفلو', fr: 'Aflou' });
    expect(WILAYAS.find((wilaya) => wilaya.code === '68')?.names).toEqual({ ar: 'بوسعادة', fr: 'Bou Saâda' });
    expect(WILAYAS.find((wilaya) => wilaya.code === '69')?.names).toEqual({
      ar: 'الأبيض سيدي الشيخ',
      fr: 'El Abiodh Sidi Cheikh',
    });
  });
});
