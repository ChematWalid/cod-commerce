import { type PlatformLanguageCode, isPlatformLanguageCode, type ProductStatus } from '@cod/shared';
import { DEMO_WORDS, type DemoWords } from './demo-words';
import type { OptionGroupSpec } from './variant-matrix';

/** The two demo collections of a store: what the seed groups its products under (P3.S2). */
export const DEMO_COLLECTION_KEYS = ['apparel', 'home'] as const;

/** One of {@link DEMO_COLLECTION_KEYS}. */
export type DemoCollectionKey = (typeof DEMO_COLLECTION_KEYS)[number];

/** One demo collection of a store, in the store's language: a manual, visible collection. */
export interface DemoCollectionSpec {
  readonly key: DemoCollectionKey;
  readonly title: string;
  readonly slug: string;
  readonly position: number;
}

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
  /** The colour of the product's synthetic image as `#rrggbb`, or `null` for a product without an image. */
  readonly imageColor: string | null;
  /** The demo collections the product belongs to. */
  readonly collectionKeys: readonly DemoCollectionKey[];
}

/** The language whose words a store of another language gets. */
const FALLBACK_LANGUAGE: PlatformLanguageCode = 'en';

const SIZES = ['S', 'M'] as const;
const SHOE_SIZES = ['38', '40', '42'] as const;

const plain = {
  oldPrice: null,
  optionGroups: [],
  brandName: null,
  tagNames: [],
  highlightTexts: [],
  imageColor: null,
  collectionKeys: [],
} as const;

/** The five products of the first demo catalog (D2129): a matrix, a draft, a hidden product, a branded one, an old price. */
function firstSpecsOf(words: DemoWords): readonly DemoProductSpec[] {
  const colors = { name: words.color, values: [words.red, words.blue] };
  return [
    {
      ...plain,
      sku: 'DEMO-TEE',
      title: words.tee,
      status: 'active',
      price: 2500,
      optionGroups: [colors, { name: words.size, values: SIZES }],
      imageColor: '#b03a2e',
      collectionKeys: ['apparel'],
    },
    { ...plain, sku: 'DEMO-MUG', title: words.mug, status: 'draft', price: 900, collectionKeys: ['home'] },
    { ...plain, sku: 'DEMO-CAP', title: words.cap, status: 'hidden', price: 1200, collectionKeys: ['apparel'] },
    {
      ...plain,
      sku: 'DEMO-BOTTLE',
      title: words.bottle,
      status: 'active',
      price: 1500,
      brandName: words.brand,
      tagNames: [words.tag],
      highlightTexts: words.highlights,
      imageColor: '#2e86c1',
      collectionKeys: ['home'],
    },
    {
      ...plain,
      sku: 'DEMO-BAG',
      title: words.bag,
      status: 'active',
      price: 1800,
      oldPrice: 2200,
      imageColor: '#a0826d',
      collectionKeys: ['apparel'],
    },
  ];
}

/** The storefront's showcase products (P3.S2): active, each with an image, three of them with options. */
function showcaseSpecsOf(words: DemoWords): readonly DemoProductSpec[] {
  const active = { ...plain, status: 'active' } as const;
  return [
    {
      ...active,
      sku: 'DEMO-DRESS',
      title: words.dress,
      price: 4900,
      oldPrice: 5900,
      optionGroups: [{ name: words.color, values: [words.black, words.beige] }],
      imageColor: '#1c2833',
      collectionKeys: ['apparel'],
    },
    {
      ...active,
      sku: 'DEMO-SANDALS',
      title: words.sandals,
      price: 3200,
      optionGroups: [{ name: words.size, values: SHOE_SIZES }],
      imageColor: '#ca6f1e',
      collectionKeys: ['apparel'],
    },
    { ...active, sku: 'DEMO-LAMP', title: words.lamp, price: 2700, imageColor: '#f4d03f', collectionKeys: ['home'] },
    {
      ...active,
      sku: 'DEMO-CUSHION',
      title: words.cushion,
      price: 1600,
      optionGroups: [{ name: words.color, values: [words.red, words.beige] }],
      imageColor: '#7d3c98',
      collectionKeys: ['home'],
    },
    { ...active, sku: 'DEMO-PERFUME', title: words.perfume, price: 3800, imageColor: '#196f3d' },
  ];
}

const wordsOf = (language: string): DemoWords =>
  DEMO_WORDS[isPlatformLanguageCode(language) ? language : FALLBACK_LANGUAGE];

/**
 * The ten demo products of a store whose language is `language` (D2129, P3.S2): a Color × Size matrix, a draft, a
 * hidden product, a product with a brand, a tag and three highlights, a simple product with an old price, and five
 * showcase products, so eight are listed on the storefront, each with an image and most in a demo collection. Names
 * are neutral and synthetic; an unknown language gets the English ones.
 */
export function demoProductsFor(language: string): readonly DemoProductSpec[] {
  const words = wordsOf(language);
  return [...firstSpecsOf(words), ...showcaseSpecsOf(words)];
}

/** The two demo collections of a store whose language is `language`, by position; an unknown language gets English. */
export function demoCollectionsFor(language: string): readonly DemoCollectionSpec[] {
  const words = wordsOf(language);
  return DEMO_COLLECTION_KEYS.map((key, position) => ({ key, ...words[key], position }));
}
