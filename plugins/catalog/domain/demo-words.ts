import type { PlatformLanguageCode } from '@cod/shared';

/** The title and slug of one demo collection in one language; slugs differ per language, so two stores never share one. */
export interface DemoCollectionWords {
  readonly title: string;
  readonly slug: string;
}

/** The words of the demo catalog in one language; sizes are written S, M and shoe sizes as numbers in every language. */
export interface DemoWords {
  readonly tee: string;
  readonly color: string;
  readonly red: string;
  readonly blue: string;
  readonly black: string;
  readonly beige: string;
  readonly size: string;
  readonly mug: string;
  readonly cap: string;
  readonly bottle: string;
  readonly bag: string;
  readonly dress: string;
  readonly sandals: string;
  readonly lamp: string;
  readonly cushion: string;
  readonly perfume: string;
  readonly brand: string;
  readonly tag: string;
  readonly highlights: readonly [string, string, string];
  readonly apparel: DemoCollectionWords;
  readonly home: DemoCollectionWords;
}

/** Neutral, synthetic product words of the demo stores (D2129); the Arabic store is the storefront's showcase (P3.S2). */
export const DEMO_WORDS: Readonly<Record<PlatformLanguageCode, DemoWords>> = {
  ar: {
    tee: 'قميص قطني تجريبي',
    color: 'اللون',
    red: 'أحمر',
    blue: 'أزرق',
    black: 'أسود',
    beige: 'بيج',
    size: 'المقاس',
    mug: 'كوب سيراميك تجريبي',
    cap: 'قبعة تجريبية',
    bottle: 'قارورة ماء تجريبية',
    bag: 'حقيبة قماشية تجريبية',
    dress: 'فستان صيفي تجريبي',
    sandals: 'صندل جلدي تجريبي',
    lamp: 'مصباح مكتب تجريبي',
    cushion: 'وسادة مطرزة تجريبية',
    perfume: 'عطر العود التجريبي',
    brand: 'علامة تجريبية',
    tag: 'جديد',
    highlights: ['توصيل سريع', 'الدفع عند الاستلام', 'جودة مضمونة'],
    apparel: { title: 'ملابس وإكسسوارات', slug: 'malabis' },
    home: { title: 'المنزل', slug: 'manzil' },
  },
  fr: {
    tee: 'T-shirt coton démo',
    color: 'Couleur',
    red: 'Rouge',
    blue: 'Bleu',
    black: 'Noir',
    beige: 'Beige',
    size: 'Taille',
    mug: 'Tasse céramique démo',
    cap: 'Casquette démo',
    bottle: 'Gourde démo',
    bag: 'Sac en toile démo',
    dress: "Robe d'été démo",
    sandals: 'Sandales en cuir démo',
    lamp: 'Lampe de bureau démo',
    cushion: 'Coussin brodé démo',
    perfume: 'Parfum oud démo',
    brand: 'Marque démo',
    tag: 'Nouveau',
    highlights: ['Livraison rapide', 'Paiement à la livraison', 'Qualité garantie'],
    apparel: { title: 'Vêtements et accessoires', slug: 'vetements' },
    home: { title: 'Maison', slug: 'maison' },
  },
  en: {
    tee: 'Demo cotton T-shirt',
    color: 'Color',
    red: 'Red',
    blue: 'Blue',
    black: 'Black',
    beige: 'Beige',
    size: 'Size',
    mug: 'Demo ceramic mug',
    cap: 'Demo cap',
    bottle: 'Demo water bottle',
    bag: 'Demo canvas bag',
    dress: 'Demo summer dress',
    sandals: 'Demo leather sandals',
    lamp: 'Demo desk lamp',
    cushion: 'Demo embroidered cushion',
    perfume: 'Demo oud perfume',
    brand: 'Demo brand',
    tag: 'New',
    highlights: ['Fast delivery', 'Cash on delivery', 'Quality guaranteed'],
    apparel: { title: 'Apparel', slug: 'apparel' },
    home: { title: 'Home', slug: 'home' },
  },
};
