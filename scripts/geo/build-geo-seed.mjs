#!/usr/bin/env node
// Builds plugins/geo/infrastructure/seed/geo-seed.json from the public dzCode.io "leblad" commune list (MIT).
// The source still has the 48-wilaya layout: this script moves the communes of the 10 wilayas created in 2019 and of
// the 11 wilayas created by law 26-06 of 4 April 2026 (JO 25/2026, numbered by decree 26-206, JO 40/2026) to their own
// province, keeps each commune's ONS code, and patches the six El Bayadh communes the source lacks.
// Source, retrieval date and licence: plugins/geo/DATA-SOURCE.md.
//
// Usage: node scripts/geo/build-geo-seed.mjs <path to leblad data/WilayaList.json>
/* global process, console -- Node globals */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'plugins/geo/infrastructure/seed/geo-seed.json');

/** The 69 wilayas (law 26-06): official French name, Arabic name, extra aliases buyers type. */
const PROVINCES = [
  [1, 'Adrar', 'أدرار', []],
  [2, 'Chlef', 'الشلف', ['Ech Cheliff']],
  [3, 'Laghouat', 'الأغواط', []],
  [4, 'Oum El Bouaghi', 'أم البواقي', ['Oum El Bouagui']],
  [5, 'Batna', 'باتنة', []],
  [6, 'Béjaïa', 'بجاية', ['Bgayet', 'Bougie']],
  [7, 'Biskra', 'بسكرة', []],
  [8, 'Béchar', 'بشار', []],
  [9, 'Blida', 'البليدة', []],
  [10, 'Bouira', 'البويرة', []],
  [11, 'Tamanrasset', 'تمنراست', ['Tamanghasset']],
  [12, 'Tébessa', 'تبسة', []],
  [13, 'Tlemcen', 'تلمسان', []],
  [14, 'Tiaret', 'تيارت', []],
  [15, 'Tizi Ouzou', 'تيزي وزو', []],
  [16, 'Alger', 'الجزائر', ['Algiers', 'El Djazair']],
  [17, 'Djelfa', 'الجلفة', []],
  [18, 'Jijel', 'جيجل', []],
  [19, 'Sétif', 'سطيف', []],
  [20, 'Saïda', 'سعيدة', []],
  [21, 'Skikda', 'سكيكدة', []],
  [22, 'Sidi Bel Abbès', 'سيدي بلعباس', []],
  [23, 'Annaba', 'عنابة', []],
  [24, 'Guelma', 'قالمة', []],
  [25, 'Constantine', 'قسنطينة', ['Qacentina']],
  [26, 'Médéa', 'المدية', []],
  [27, 'Mostaganem', 'مستغانم', []],
  [28, "M'Sila", 'المسيلة', ['Msila']],
  [29, 'Mascara', 'معسكر', []],
  [30, 'Ouargla', 'ورقلة', []],
  [31, 'Oran', 'وهران', ['Wahran']],
  [32, 'El Bayadh', 'البيض', []],
  [33, 'Illizi', 'إليزي', []],
  [34, 'Bordj Bou Arréridj', 'برج بوعريريج', ['BBA']],
  [35, 'Boumerdès', 'بومرداس', []],
  [36, 'El Tarf', 'الطارف', []],
  [37, 'Tindouf', 'تندوف', []],
  [38, 'Tissemsilt', 'تيسمسيلت', []],
  [39, 'El Oued', 'الوادي', []],
  [40, 'Khenchela', 'خنشلة', []],
  [41, 'Souk Ahras', 'سوق أهراس', []],
  [42, 'Tipaza', 'تيبازة', ['Tipasa']],
  [43, 'Mila', 'ميلة', []],
  [44, 'Aïn Defla', 'عين الدفلى', []],
  [45, 'Naâma', 'النعامة', []],
  [46, 'Aïn Témouchent', 'عين تموشنت', []],
  [47, 'Ghardaïa', 'غرداية', []],
  [48, 'Relizane', 'غليزان', []],
  [49, 'Timimoun', 'تيميمون', []],
  [50, 'Bordj Badji Mokhtar', 'برج باجي مختار', []],
  [51, 'Ouled Djellal', 'أولاد جلال', []],
  [52, 'Béni Abbès', 'بني عباس', []],
  [53, 'In Salah', 'عين صالح', ['Ain Salah']],
  [54, 'In Guezzam', 'عين قزام', ['Ain Guezzam']],
  [55, 'Touggourt', 'تقرت', []],
  [56, 'Djanet', 'جانت', []],
  [57, "El M'Ghair", 'المغير', ['El Meghaier']],
  [58, 'El Meniaa', 'المنيعة', ['El Menia']],
  // Law 26-06 (JO 25/2026); names and seats from decree 26-206 (JO 40/2026, French and Arabic editions).
  [59, 'Aflou', 'أفلو', []],
  [60, 'Barika', 'بريكة', []],
  [61, 'El Kantara', 'القنطرة', []],
  [62, 'Bir El Ater', 'بئر العاتر', []],
  [63, 'El Aricha', 'العريشة', []],
  [64, 'Ksar Chellala', 'قصر الشلالة', ['Ksar El Chellala']],
  [65, 'Aïn Ouessara', 'عين وسارة', ['Ain Oussera']],
  [66, 'Messaad', 'مسعد', []],
  [67, 'Ksar El Boukhari', 'قصر البخاري', ['Ksar Boukhari']],
  [68, 'Bou Saâda', 'بوسعادة', ['Boussaada']],
  [69, 'El Abiodh Sidi Cheikh', 'الأبيض سيدي الشيخ', ['Labiodh Sidi Cheikh']],
];

/** Communes (ONS codes) of the wilayas created in 2019, taken from their former wilaya. */
const NEW_PROVINCE_COMMUNES = {
  49: [103, 107, 109, 110, 116, 117, 120, 123, 124, 127],
  50: [125, 128],
  51: [705, 706, 707, 708, 709, 710],
  52: [803, 805, 807, 808, 811, 812, 814, 818, 819, 820],
  53: [1103, 1108, 1110],
  54: [1104, 1107],
  55: [3006, 3007, 3008, 3009, 3010, 3013, 3014, 3015, 3016, 3017, 3018, 3019, 3020],
  56: [3302, 3305],
  57: [3921, 3922, 3923, 3924, 3927, 3928, 3929, 3930],
  58: [4702, 4711, 4712],
};

/**
 * Communes (ONS codes) of the wilayas created by law 26-06, articles 52 bis 10 to 52 bis 20 of law 84-09 as amended
 * (JO 25/2026). Each JO name was matched to a unique commune of the former wilaya, and each former wilaya's remaining
 * list equals its amended article (7, 9, 11, 16, 17, 18, 21, 30, 32, 36): see DATA-SOURCE.md.
 */
const LAW_26_06_COMMUNES = {
  59: [310, 311, 312, 313, 314, 315, 316, 317, 319, 321, 322, 324],
  60: [514, 515, 518, 529, 542, 543, 555, 556],
  61: [703, 717, 718, 719, 720],
  62: [1202, 1209, 1215, 1228],
  63: [1310, 1332, 1341, 1343],
  64: [1409, 1429, 1430, 1435, 1439, 1440],
  65: [1708, 1709, 1711, 1719, 1720, 1721, 1731, 1732, 1733, 1735],
  66: [1706, 1707, 1717, 1718, 1722, 1724, 1729, 1734],
  67: [
    2603, 2604, 2608, 2610, 2617, 2618, 2622, 2623, 2625, 2631, 2632, 2635, 2638, 2640, 2641, 2642, 2649, 2651, 2657,
    2658, 2664,
  ],
  68: [
    2807, 2808, 2820, 2821, 2822, 2823, 2824, 2825, 2826, 2827, 2833, 2834, 2835, 2836, 2837, 2838, 2839, 2841, 2842,
    2843, 2844, 2846, 2847,
  ],
  69: [3207, 3208, 3209, 3213, 3214, 3216, 3219],
};

/** Missing from the source (its El Bayadh dairas are shifted); names from the official ONS list. */
const PATCHED_COMMUNES = [
  { code: 3207, name: 'EL ABIODH SIDI CHEIKH', name_ar: 'الأبيض سيدي الشيخ', daira: 'EL ABIODH SIDI CHEIKH' },
  { code: 3208, name: 'AIN EL ORAK', name_ar: 'عين العراك', daira: 'EL ABIODH SIDI CHEIKH' },
  { code: 3213, name: 'BOUSSEMGHOUN', name_ar: 'بوسمغون', daira: 'BOUSSEMGHOUN' },
  { code: 3218, name: 'SIDI AMEUR', name_ar: 'سيدي عامر', daira: 'CHELLALA' },
  { code: 3220, name: 'TOUSMOULINE', name_ar: 'توسمولين', daira: 'EL BAYADH' },
  { code: 3221, name: 'SIDI SLIMANE', name_ar: 'سيدي سليمان', daira: 'BOUSSEMGHOUN' },
];

/** Province seats that are not daira seats in the source (or whose names differ from their daira's). */
const EXTRA_STOPDESK = new Set([3927, 4702, 3901, 1332]); // 1332 El Aricha, seat of wilaya 63
const EXPECTED_PROVINCES = 69;
/** Commune lists of law 26-06 (JO 25/2026), one per wilaya it rewrote: each count must match the seed. */
const LAW_26_06_ARTICLES = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'law-26-06-articles.json'), 'utf8'),
);
const EXPECTED_COMMUNES = 1541;

/** Two-digit wilaya code, as `WilayaCode` in `@cod/shared` (`'01'`–`'58'`). */
const wilayaCode = (n) => String(n).padStart(2, '0');

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(wilaya d[eé]l[eé]gu[eé]e\)/gi, '')
    .replace(/[-'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());

/** Aliases other than the display name itself (compared folded: matching ignores case and accents). */
const withoutSelf = (name, aliases) =>
  [...new Set(aliases)].filter((a) => fold(a) !== fold(name) || /\p{Script=Arabic}/u.test(a));

/** Wilaya seats (code xx01 in the 48-wilaya numbering) and daira seats get a stop desk by default. */
const isSeat = (source) => source.code % 100 === 1 || fold(source.name) === fold(source.daira);

function readSource(path) {
  const wilayas = JSON.parse(readFileSync(path, 'utf8'));
  const byCode = new Map();
  for (const w of wilayas) {
    for (const d of w.dairats ?? []) {
      for (const b of d.baladyiats ?? []) {
        if (!byCode.has(b.code)) byCode.set(b.code, { code: b.code, name: b.name, name_ar: b.name_ar, daira: d.name });
      }
    }
  }
  for (const p of PATCHED_COMMUNES) {
    if (byCode.has(p.code)) throw new Error(`patched commune ${p.code} already in source`);
    byCode.set(p.code, p);
  }
  return [...byCode.values()];
}

function provinceOf(code) {
  for (const [province, codes] of Object.entries({ ...NEW_PROVINCE_COMMUNES, ...LAW_26_06_COMMUNES })) {
    if (codes.includes(code)) return Number(province);
  }
  return Math.floor(code / 100);
}

function toTown(source) {
  const name = titleCase(source.name);
  const aliases = withoutSelf(name, [fold(source.name), source.name_ar.trim()]);
  return {
    codeOns: source.code,
    provinceCode: wilayaCode(provinceOf(source.code)),
    name,
    arabicName: source.name_ar.trim(),
    names: aliases,
    isStopdesk: isSeat(source) || EXTRA_STOPDESK.has(source.code),
    isHomeDelivery: true,
  };
}

function build(sourcePath) {
  const towns = readSource(sourcePath)
    .map(toTown)
    .sort((a, b) => a.codeOns - b.codeOns);
  const provinces = PROVINCES.map(([code, name, arabicName, extra]) => {
    const own = towns.filter((t) => t.provinceCode === wilayaCode(code));
    if (own.length === 0) throw new Error(`province ${code} has no commune`);
    if (!own.some((t) => t.isStopdesk)) own[0].isStopdesk = true;
    const names = withoutSelf(name, [fold(name), arabicName, ...extra]);
    return { code: wilayaCode(code), name, arabicName, names };
  });
  for (const { article, wilaya, communes } of LAW_26_06_ARTICLES.articles) {
    const actual = towns.filter((t) => t.provinceCode === wilaya).length;
    if (actual !== communes.length)
      throw new Error(`wilaya ${wilaya}: ${actual} communes, JO article ${article} lists ${communes.length}`);
  }
  if (provinces.length !== EXPECTED_PROVINCES) throw new Error(`expected ${EXPECTED_PROVINCES} provinces`);
  if (towns.length !== EXPECTED_COMMUNES)
    throw new Error(`expected ${EXPECTED_COMMUNES} communes, got ${towns.length}`);
  return {
    source: 'dzcode-io/leblad@1.0.3 data v1.1 (MIT); 2019 and 2026 (law 26-06) wilaya splits applied',
    provinces,
    towns,
  };
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('usage: node scripts/geo/build-geo-seed.mjs <leblad data/WilayaList.json>');
  process.exit(2);
}
const seed = build(sourcePath);
const lines = (rows) => rows.map((row) => `  ${JSON.stringify(row)}`).join(',\n');
writeFileSync(
  OUT,
  `{\n "source": ${JSON.stringify(seed.source)},\n "provinces": [\n${lines(seed.provinces)}\n ],\n "towns": [\n${lines(seed.towns)}\n ]\n}\n`,
);
console.log(`wrote ${OUT}: ${seed.provinces.length} provinces, ${seed.towns.length} communes`);
