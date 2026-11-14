import { type PlatformLanguageCode, isPlatformLanguageCode, type ProductStatus } from '@cod/shared';
import type { OptionGroupSpec } from './variant-matrix';

/** One synthetic product of a demo store (D2129): what the seed creates, in the store's language. */
export interface DemoProductSpec {
  /** Marks the product as seeded: a store already holding it is left alone. */
  readonly sku: string;
  readonly title: string;
  readonly status: ProductStatus;
  readonly price: number;
  readonly oldPrice: number | null;
  readonly optionGroups: readonly OptionGroupSpec[];
  readonly brandName: string | null;
  readonly tagNames: readonly string[];
  readonly highlightTexts: readonly string[];
}

/** The words of the demo products in one language; sizes are written S and M in every language. */
interface DemoWords {
  readonly tee: string;
  readonly color: string;
  readonly red: string;
  readonly blue: string;
  readonly size: string;
  readonly mug: string;
  readonly cap: string;
  readonly bottle: string;
  readonly bag: string;
  readonly brand: string;
  readonly tag: string;
  readonly highlights: readonly [string, string, string];
}

const DEMO_WORDS: Readonly<Record<PlatformLanguageCode, DemoWords>> = {
  ar: {
    tee: 'قميص قطني تجريبي',
    color: 'اللون',
    red: 'أحمر',
    blue: 'أزرق',
    size: 'المقاس',
    mug: 'كوب سيراميك تجريبي',
    cap: 'قبعة تجريبية',
    bottle: 'قارورة ماء تجريبية',
    bag: 'حقيبة قماشية تجريبية',
    brand: 'علامة تجريبية',
    tag: 'جديد',
    highlights: ['توصيل سريع', 'الدفع عند الاستلام', 'جودة مضمونة'],
  },
  fr: {
    tee: 'T-shirt coton démo',
    color: 'Couleur',
    red: 'Rouge',
    blue: 'Bleu',
    size: 'Taille',
    mug: 'Tasse céramique démo',
    cap: 'Casquette démo',
    bottle: 'Gourde démo',
    bag: 'Sac en toile démo',
    brand: 'Marque démo',
    tag: 'Nouveau',
    highlights: ['Livraison rapide', 'Paiement à la livraison', 'Qualité garantie'],
  },
  en: {
    tee: 'Demo cotton T-shirt',
    color: 'Color',
    red: 'Red',
    blue: 'Blue',
    size: 'Size',
    mug: 'Demo ceramic mug',
    cap: 'Demo cap',
    bottle: 'Demo water bottle',
    bag: 'Demo canvas bag',
    brand: 'Demo brand',
    tag: 'New',
    highlights: ['Fast delivery', 'Cash on delivery', 'Quality guaranteed'],
  },
};

/** The language whose words a store of another language gets. */
const FALLBACK_LANGUAGE: PlatformLanguageCode = 'en';

const SIZES = ['S', 'M'] as const;

const plain = { oldPrice: null, optionGroups: [], brandName: null, tagNames: [], highlightTexts: [] } as const;

function specsOf(words: DemoWords): readonly DemoProductSpec[] {
  const colors = { name: words.color, values: [words.red, words.blue] };
  return [
    {
      ...plain,
      sku: 'DEMO-TEE',
      title: words.tee,
      status: 'active',
      price: 2500,
      optionGroups: [colors, { name: words.size, values: SIZES }],
    },
    { ...plain, sku: 'DEMO-MUG', title: words.mug, status: 'draft', price: 900 },
    { ...plain, sku: 'DEMO-CAP', title: words.cap, status: 'hidden', price: 1200 },
    {
      ...plain,
      sku: 'DEMO-BOTTLE',
      title: words.bottle,
      status: 'active',
      price: 1500,
      brandName: words.brand,
      tagNames: [words.tag],
      highlightTexts: words.highlights,
    },
    { ...plain, sku: 'DEMO-BAG', title: words.bag, status: 'active', price: 1800, oldPrice: 2200 },
  ];
}

/**
 * The five demo products of a store whose language is `language` (D2129): a Color × Size matrix, a draft, a hidden
 * product, a product with a brand, a tag and three highlights, and a simple product with an old price. Names are
 * neutral and synthetic; an unknown language gets the English ones.
 */
export function demoProductsFor(language: string): readonly DemoProductSpec[] {
  return specsOf(DEMO_WORDS[isPlatformLanguageCode(language) ? language : FALLBACK_LANGUAGE]);
}
