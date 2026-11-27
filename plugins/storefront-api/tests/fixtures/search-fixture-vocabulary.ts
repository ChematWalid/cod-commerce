/** The script a product name or a query is written in; spike E's expected-id rule keeps to one script. */
export type FixtureScript = 'ar' | 'lat';

/** A concept and the spellings names use for it, in turn: tashkeel, hamza seats, ة/ه, ى/ي, "ال", accents. */
export interface FixtureTerm {
  readonly tag: string;
  readonly spellings: readonly string[];
}

/** One block of a store's names: `count` names of `noun modifier`, in one script. */
export interface FixtureVocabulary {
  readonly store: number;
  readonly script: FixtureScript;
  readonly count: number;
  readonly nouns: readonly FixtureTerm[];
  readonly modifiers: readonly FixtureTerm[];
}

const term = (tag: string, ...spellings: string[]): FixtureTerm => ({ tag, spellings });

/** Store 0: clothing in Arabic. */
const CLOTHING_AR: FixtureVocabulary = {
  store: 0,
  script: 'ar',
  count: 85,
  nouns: [
    term('kaftan', 'قفطان', 'قُفطان', 'القفطان'),
    term('jellaba', 'جلابة', 'جلّابة', 'الجلابه'),
    term('abaya', 'عباءة', 'عباءه', 'عَباءة'),
    term('hijab', 'حجاب', 'حِجاب', 'الحجاب'),
    term('shoe', 'حذاء', 'حِذاء'),
    term('sabbat', 'سباط', 'سبّاط'),
    term('shirt', 'قميص', 'قَميص'),
    term('sirwal', 'سِروال', 'سروال'),
    term('dress', 'فستان', 'فُستان'),
    term('slipper', 'شلاكة', 'شلاكه'),
    term('burnous', 'برنوس', 'بُرنوس'),
    term('coat', 'معطف', 'المعطف', 'مِعطف'),
    term('gandoura', 'قندورة', 'قندوره'),
    term('karakou', 'كاراكو'),
  ],
  modifiers: [
    term('red', 'أحمر', 'احمر'),
    term('blue', 'أزرق', 'ازرق'),
    term('black', 'أسود', 'اسود'),
    term('white', 'أبيض', 'ابيض'),
    term('green', 'أخضر', 'اخضر'),
    term('silk', 'حرير', 'حَرير'),
    term('wool', 'صوف'),
    term('cotton', 'قطن', 'قُطن'),
    term('women', 'نسائي', 'نسائى'),
    term('men', 'رجالي', 'رجالى'),
    term('kids', 'للأطفال', 'للاطفال'),
    term('traditional', 'تقليدي', 'تقليدى'),
    term('embroidered', 'مطرز', 'مُطرّز'),
    term('summer', 'صيفي', 'صيفى'),
    term('winter', 'شتوي', 'شتوى'),
    term('leather', 'جلد'),
  ],
};

/** Store 0: Darija product names in Latin script. */
const CLOTHING_LATIN: FixtureVocabulary = {
  store: 0,
  script: 'lat',
  count: 15,
  nouns: [
    term('sabbat', 'Sabbat', 'Sebbat'),
    term('jellaba', 'Jellaba', 'Djellaba'),
    term('kaftan', 'Kaftan', 'Caftan'),
    term('tricot', 'Tricot', 'Triko'),
    term('slipper', 'Chlaka', 'Shlaka'),
    term('karakou', 'Karakou'),
  ],
  modifiers: [
    term('sport', 'sport style running', 'sport'),
    term('girls', 'bnat'),
    term('men', 'rjal'),
    term('traditional', 'beldi'),
    term('pretty', 'zwin'),
    term('new', 'jdid'),
  ],
};

/** Store 1: cosmetics and home in Arabic. */
const HOME_AR: FixtureVocabulary = {
  store: 1,
  script: 'ar',
  count: 100,
  nouns: [
    term('perfume', 'عطر', 'العطر', 'عِطر'),
    term('cream', 'كريم'),
    term('soap', 'صابون', 'الصابون'),
    term('shampoo', 'شامبو'),
    term('oil', 'زيت'),
    term('mirror', 'مرآة', 'مراه', 'مرآه'),
    term('pillow', 'وسادة', 'وساده', 'الوسادة'),
    term('carpet', 'سجادة', 'سجاده'),
    term('vase', 'مزهرية', 'مزهريه'),
    term('curtain', 'ستارة', 'ستاره'),
    term('teapot', 'إبريق', 'ابريق'),
    term('cup', 'فنجان', 'فِنجان'),
    term('tajine', 'طاجين'),
    term('lamp', 'مصباح', 'مِصباح'),
    term('henna', 'حناء', 'حنّاء'),
    term('blanket', 'بطانية', 'بطانيه'),
  ],
  modifiers: [
    term('natural', 'طبيعي', 'طبيعى'),
    term('face', 'للوجه'),
    term('hair', 'للشعر'),
    term('copper', 'نحاسي', 'نحاسى'),
    term('wooden', 'خشبي', 'خشبى'),
    term('glass', 'زجاجي', 'زجاجى'),
    term('rose', 'ورد'),
    term('argan', 'أرغان', 'ارغان'),
    term('small', 'صغير'),
    term('large', 'كبير'),
    term('moroccan', 'مغربي', 'مغربى'),
    term('luxury', 'فاخر'),
  ],
};

/** Store 2: electronics accessories in French. */
const ELECTRONICS_FR: FixtureVocabulary = {
  store: 2,
  script: 'lat',
  count: 90,
  nouns: [
    term('earbuds', 'Écouteurs', 'Ecouteurs'),
    term('cable', 'Câble', 'Cable'),
    term('charger', 'Chargeur'),
    term('case', 'Coque'),
    term('powerbank', 'Batterie externe'),
    term('usbkey', 'Clé USB', 'Cle USB'),
    term('mouse', 'Souris'),
    term('keyboard', 'Clavier'),
    term('speaker', 'Haut-parleur', 'Haut parleur'),
    term('holder', 'Support téléphone'),
    term('watch', 'Montre connectée', 'Montre connectee'),
    term('adapter', 'Adaptateur'),
    term('screenprotector', 'Protège-écran', 'Protege ecran'),
    term('headset', 'Casque'),
    term('lamp', 'Lampe LED'),
  ],
  modifiers: [
    term('fast', 'rapide'),
    term('wireless', 'sans fil'),
    term('bluetooth', 'Bluetooth'),
    term('black', 'noir'),
    term('white', 'blanc'),
    term('waterproof', 'étanche', 'etanche'),
    term('magnetic', 'magnétique', 'magnetique'),
    term('typec', 'Type-C'),
    term('iphone', 'iPhone'),
    term('samsung', 'Samsung'),
    term('watt20', '20W'),
    term('gaming', 'gamer'),
  ],
};

/** Store 2: the few Arabic names of the electronics store. */
const ELECTRONICS_AR: FixtureVocabulary = {
  store: 2,
  script: 'ar',
  count: 10,
  nouns: [
    term('speaker', 'مكبر صوت'),
    term('charger', 'شاحن'),
    term('earbuds', 'سماعة', 'سماعه'),
    term('cable', 'كابل'),
  ],
  modifiers: [
    term('fast', 'سريع'),
    term('bluetooth', 'بلوتوث'),
    term('black', 'أسود', 'اسود'),
    term('wireless', 'لاسلكي', 'لاسلكى'),
  ],
};

/** Every block of the fixture: 300 names over 3 stores (ADR 0014 spike E shape, D3208). */
export const FIXTURE_VOCABULARIES: readonly FixtureVocabulary[] = [
  CLOTHING_AR,
  CLOTHING_LATIN,
  HOME_AR,
  ELECTRONICS_FR,
  ELECTRONICS_AR,
];
