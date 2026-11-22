import type { FixtureScript } from './search-fixture-vocabulary';

/** The query classes of spike E (ADR 0014), with how many queries each holds. */
export const QUERY_CLASS_COUNTS = {
  plain: 6,
  diacritics: 8,
  hamza: 10,
  orthography: 10,
  article: 8,
  french: 7,
  darija: 7,
  typo: 4,
} as const;

export type QueryClass = keyof typeof QUERY_CLASS_COUNTS;

/** A buyer query: its store, class, the concepts it asks for, its script, and whether it crosses scripts. */
export interface FixtureQuery {
  readonly q: string;
  readonly store: number;
  readonly kind: QueryClass;
  readonly tags: readonly string[];
  readonly script: FixtureScript;
  /** One of the Darija cross-script queries: names in the other script count too (spike E, with synonyms). */
  readonly crossScript?: boolean;
}

const ar = (kind: QueryClass, store: number, q: string, ...tags: string[]): FixtureQuery => ({
  q,
  store,
  kind,
  tags,
  script: 'ar',
});

const lat = (kind: QueryClass, store: number, q: string, ...tags: string[]): FixtureQuery => ({
  q,
  store,
  kind,
  tags,
  script: 'lat',
});

/** The 60 queries of the recall gate. */
export const FIXTURE_QUERIES: readonly FixtureQuery[] = [
  ar('plain', 0, 'قفطان', 'kaftan'),
  ar('plain', 0, 'حجاب', 'hijab'),
  ar('plain', 1, 'صابون', 'soap'),
  ar('plain', 1, 'شامبو', 'shampoo'),
  lat('plain', 2, 'chargeur', 'charger'),
  lat('plain', 2, 'souris', 'mouse'),

  ar('diacritics', 0, 'قُفْطَان', 'kaftan'),
  ar('diacritics', 0, 'حِجَاب', 'hijab'),
  ar('diacritics', 0, 'فُسْتَان', 'dress'),
  ar('diacritics', 0, 'قَمِيص', 'shirt'),
  ar('diacritics', 1, 'فِنْجَان', 'cup'),
  ar('diacritics', 1, 'مِصْبَاح', 'lamp'),
  ar('diacritics', 1, 'عِطْر', 'perfume'),
  ar('diacritics', 0, 'سروال', 'sirwal'),

  ar('hamza', 0, 'احمر', 'red'),
  ar('hamza', 0, 'أزرق', 'blue'),
  ar('hamza', 0, 'ابيض', 'white'),
  ar('hamza', 0, 'أسود', 'black'),
  ar('hamza', 0, 'للاطفال', 'kids'),
  ar('hamza', 1, 'ابريق', 'teapot'),
  ar('hamza', 1, 'إبريق', 'teapot'),
  ar('hamza', 1, 'مراة', 'mirror'),
  ar('hamza', 1, 'ارغان', 'argan'),
  ar('hamza', 1, 'زيت أرغان', 'oil', 'argan'),

  ar('orthography', 0, 'جلابه', 'jellaba'),
  ar('orthography', 0, 'جلابة', 'jellaba'),
  ar('orthography', 0, 'شلاكه', 'slipper'),
  ar('orthography', 0, 'نسائى', 'women'),
  ar('orthography', 0, 'رجالي', 'men'),
  ar('orthography', 0, 'تقليدى', 'traditional'),
  ar('orthography', 1, 'وساده', 'pillow'),
  ar('orthography', 1, 'ستارة', 'curtain'),
  ar('orthography', 1, 'طبيعى', 'natural'),
  ar('orthography', 1, 'مزهرية', 'vase'),

  ar('article', 0, 'القفطان', 'kaftan'),
  ar('article', 0, 'الجلابة', 'jellaba'),
  ar('article', 0, 'الحجاب', 'hijab'),
  ar('article', 0, 'المعطف', 'coat'),
  ar('article', 1, 'العطر', 'perfume'),
  ar('article', 1, 'الصابون', 'soap'),
  ar('article', 1, 'الوسادة', 'pillow'),
  ar('article', 1, 'وسادة', 'pillow'),

  lat('french', 2, 'ecouteurs', 'earbuds'),
  lat('french', 2, 'câble', 'cable'),
  lat('french', 2, 'cle usb', 'usbkey'),
  lat('french', 2, 'etanche', 'waterproof'),
  lat('french', 2, 'magnetique', 'magnetic'),
  lat('french', 2, 'protege ecran', 'screenprotector'),
  lat('french', 2, 'montre connectée', 'watch'),

  lat('darija', 0, 'sabbat', 'sabbat'),
  lat('darija', 0, 'djellaba', 'jellaba'),
  lat('darija', 0, 'caftan', 'kaftan'),
  lat('darija', 0, 'triko', 'tricot'),
  lat('darija', 0, 'shlaka', 'slipper'),
  { ...lat('darija', 0, 'jellaba', 'jellaba'), crossScript: true },
  { ...ar('darija', 0, 'سباط', 'sabbat'), crossScript: true },

  ar('typo', 0, 'قفطن', 'kaftan'),
  ar('typo', 1, 'شامبوو', 'shampoo'),
  lat('typo', 2, 'chargur', 'charger'),
  lat('typo', 2, 'souriss', 'mouse'),
];
