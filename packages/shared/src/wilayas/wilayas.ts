/** Number of Algerian wilayas (provinces) since the 2019 reform. */
export const WILAYA_COUNT = 58;

/** Official two-digit wilaya codes, in order. */
export const WILAYA_CODES = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
  '32',
  '33',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '47',
  '48',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '57',
  '58',
] as const satisfies readonly string[] & { length: typeof WILAYA_COUNT };

/** A two-digit wilaya code, `'01'` to `'58'`. */
export type WilayaCode = (typeof WILAYA_CODES)[number];

/** Display names of a wilaya. */
export interface WilayaNames {
  readonly ar: string;
  readonly fr: string;
}

/** A wilaya and, when known, its names. */
export interface Wilaya {
  readonly code: WilayaCode;
  readonly names: WilayaNames | null;
}

const KNOWN_NAMES: Readonly<Partial<Record<WilayaCode, WilayaNames>>> = {
  '01': { ar: 'أدرار', fr: 'Adrar' },
  '09': { ar: 'البليدة', fr: 'Blida' },
  '16': { ar: 'الجزائر', fr: 'Alger' },
  '25': { ar: 'قسنطينة', fr: 'Constantine' },
  '31': { ar: 'وهران', fr: 'Oran' },
};

/**
 * Every wilaya, in code order.
 *
 * @remarks Stub — owner: P3.S1. Only 01, 09, 16, 25 and 31 carry names; the others have `names: null`.
 */
export const WILAYAS: readonly Wilaya[] = WILAYA_CODES.map((code) => ({ code, names: KNOWN_NAMES[code] ?? null }));

/** Narrows a string to a {@link WilayaCode}; `'7'` and `'59'` are rejected. */
export function isWilayaCode(value: string): value is WilayaCode {
  return (WILAYA_CODES as readonly string[]).includes(value);
}
