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

/** A wilaya and its names. */
export interface Wilaya {
  readonly code: WilayaCode;
  readonly names: WilayaNames | null;
}

/** Arabic and French name of every wilaya, as in the geo seed (`plugins/geo/infrastructure/seed/geo-seed.json`). */
const WILAYA_NAMES: Readonly<Record<WilayaCode, WilayaNames>> = {
  '01': { ar: 'أدرار', fr: 'Adrar' },
  '02': { ar: 'الشلف', fr: 'Chlef' },
  '03': { ar: 'الأغواط', fr: 'Laghouat' },
  '04': { ar: 'أم البواقي', fr: 'Oum El Bouaghi' },
  '05': { ar: 'باتنة', fr: 'Batna' },
  '06': { ar: 'بجاية', fr: 'Béjaïa' },
  '07': { ar: 'بسكرة', fr: 'Biskra' },
  '08': { ar: 'بشار', fr: 'Béchar' },
  '09': { ar: 'البليدة', fr: 'Blida' },
  '10': { ar: 'البويرة', fr: 'Bouira' },
  '11': { ar: 'تمنراست', fr: 'Tamanrasset' },
  '12': { ar: 'تبسة', fr: 'Tébessa' },
  '13': { ar: 'تلمسان', fr: 'Tlemcen' },
  '14': { ar: 'تيارت', fr: 'Tiaret' },
  '15': { ar: 'تيزي وزو', fr: 'Tizi Ouzou' },
  '16': { ar: 'الجزائر', fr: 'Alger' },
  '17': { ar: 'الجلفة', fr: 'Djelfa' },
  '18': { ar: 'جيجل', fr: 'Jijel' },
  '19': { ar: 'سطيف', fr: 'Sétif' },
  '20': { ar: 'سعيدة', fr: 'Saïda' },
  '21': { ar: 'سكيكدة', fr: 'Skikda' },
  '22': { ar: 'سيدي بلعباس', fr: 'Sidi Bel Abbès' },
  '23': { ar: 'عنابة', fr: 'Annaba' },
  '24': { ar: 'قالمة', fr: 'Guelma' },
  '25': { ar: 'قسنطينة', fr: 'Constantine' },
  '26': { ar: 'المدية', fr: 'Médéa' },
  '27': { ar: 'مستغانم', fr: 'Mostaganem' },
  '28': { ar: 'المسيلة', fr: "M'Sila" },
  '29': { ar: 'معسكر', fr: 'Mascara' },
  '30': { ar: 'ورقلة', fr: 'Ouargla' },
  '31': { ar: 'وهران', fr: 'Oran' },
  '32': { ar: 'البيض', fr: 'El Bayadh' },
  '33': { ar: 'إليزي', fr: 'Illizi' },
  '34': { ar: 'برج بوعريريج', fr: 'Bordj Bou Arréridj' },
  '35': { ar: 'بومرداس', fr: 'Boumerdès' },
  '36': { ar: 'الطارف', fr: 'El Tarf' },
  '37': { ar: 'تندوف', fr: 'Tindouf' },
  '38': { ar: 'تيسمسيلت', fr: 'Tissemsilt' },
  '39': { ar: 'الوادي', fr: 'El Oued' },
  '40': { ar: 'خنشلة', fr: 'Khenchela' },
  '41': { ar: 'سوق أهراس', fr: 'Souk Ahras' },
  '42': { ar: 'تيبازة', fr: 'Tipaza' },
  '43': { ar: 'ميلة', fr: 'Mila' },
  '44': { ar: 'عين الدفلى', fr: 'Aïn Defla' },
  '45': { ar: 'النعامة', fr: 'Naâma' },
  '46': { ar: 'عين تموشنت', fr: 'Aïn Témouchent' },
  '47': { ar: 'غرداية', fr: 'Ghardaïa' },
  '48': { ar: 'غليزان', fr: 'Relizane' },
  '49': { ar: 'تيميمون', fr: 'Timimoun' },
  '50': { ar: 'برج باجي مختار', fr: 'Bordj Badji Mokhtar' },
  '51': { ar: 'أولاد جلال', fr: 'Ouled Djellal' },
  '52': { ar: 'بني عباس', fr: 'Béni Abbès' },
  '53': { ar: 'عين صالح', fr: 'In Salah' },
  '54': { ar: 'عين قزام', fr: 'In Guezzam' },
  '55': { ar: 'تقرت', fr: 'Touggourt' },
  '56': { ar: 'جانت', fr: 'Djanet' },
  '57': { ar: 'المغير', fr: "El M'Ghair" },
  '58': { ar: 'المنيعة', fr: 'El Meniaa' },
};

/**
 * Every wilaya, in code order, with its names.
 *
 * @remarks Every wilaya has names since P3.S1 (D3115); `names` stays nullable so existing callers keep compiling.
 */
export const WILAYAS: readonly Wilaya[] = WILAYA_CODES.map((code) => ({ code, names: WILAYA_NAMES[code] }));

/** Narrows a string to a {@link WilayaCode}; `'7'` and `'59'` are rejected. */
export function isWilayaCode(value: string): value is WilayaCode {
  return (WILAYA_CODES as readonly string[]).includes(value);
}

/** A wilaya code as a URL path writes it: one or two decimal digits, `1`, `01` or `16`. */
const WILAYA_CODE_PARAM = /^\d{1,2}$/;

/**
 * Reads a wilaya code from a path parameter: `'16'`, `'1'` and `'01'` give `'16'`, `'01'` and `'01'` (D3115). Anything
 * else (`'0'`, `'59'`, `'016'`, `'1.5'`, `'abc'`) gives `null`, which the API answers as "province not found".
 */
export function parseWilayaCodeParam(param: string): WilayaCode | null {
  if (!WILAYA_CODE_PARAM.test(param)) return null;
  const code = param.padStart(2, '0');
  return isWilayaCode(code) ? code : null;
}
