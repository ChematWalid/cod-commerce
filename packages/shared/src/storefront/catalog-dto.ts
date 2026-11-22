import { z } from 'zod';
import { moneySchema } from '../catalog/money';

/** Most products one storefront list or search page returns; a larger `take` is clamped to it. */
export const STOREFRONT_LIST_MAX_TAKE = 48;

/** Products per storefront list page when the request names no `take`. */
export const STOREFRONT_LIST_DEFAULT_TAKE = 24;

/** Shortest search query that runs; a shorter one answers an empty page. */
export const STOREFRONT_SEARCH_MIN_QUERY = 2;

/** Longest search query read; the rest is cut off. */
export const STOREFRONT_SEARCH_MAX_QUERY = 100;

/** The orders a storefront product list can take; an unknown sort falls back to the first. */
export const STOREFRONT_SORTS = ['newest', 'price-asc', 'price-desc'] as const;

/** One of the {@link STOREFRONT_SORTS}. */
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

/** A catalog id as the public API writes it: an opaque decimal string (ADR 0003), never a number. */
export const storefrontIdSchema = z.string().regex(/^[1-9][0-9]{0,18}$/);

/** A product in a list, search result or grid. Prices are whole DZD, as `VisibleVariant.price` (ADR 0004). */
export const storefrontProductCardSchema = z.object({
  id: storefrontIdSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  price: moneySchema,
  oldPrice: moneySchema.nullable(),
  imagePath: z.string().min(1).nullable(),
  soldOut: z.boolean(),
});

/** A product in a list; see {@link storefrontProductCardSchema}. */
export type StorefrontProductCard = z.output<typeof storefrontProductCardSchema>;

/** One page of products: the items and where they sit in the whole result. */
export const storefrontProductPageSchema = z.object({
  items: z.array(storefrontProductCardSchema),
  totalItems: z.number().int().min(0),
  skip: z.number().int().min(0),
  take: z.number().int().min(1).max(STOREFRONT_LIST_MAX_TAKE),
});

/** One page of products; see {@link storefrontProductPageSchema}. */
export type StorefrontProductPage = z.output<typeof storefrontProductPageSchema>;

const storefrontImageSchema = z.object({ path: z.string().min(1), alt: z.string() });

const storefrontOptionGroupSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  options: z.array(z.object({ code: z.string().min(1), name: z.string().min(1) })),
});

const storefrontVariantSchema = z.object({
  id: storefrontIdSchema,
  sku: z.string(),
  price: moneySchema,
  oldPrice: moneySchema.nullable(),
  optionCodes: z.array(z.string().min(1)),
  imagePath: z.string().min(1).nullable(),
  soldOut: z.boolean(),
});

/** A product page: only visible variants and the option values they use (#246). */
export const storefrontProductSchema = z.object({
  id: storefrontIdSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  images: z.array(storefrontImageSchema),
  optionGroups: z.array(storefrontOptionGroupSchema),
  variants: z.array(storefrontVariantSchema),
  metaTitle: z.string(),
  metaDescription: z.string(),
});

/** A product page; see {@link storefrontProductSchema}. */
export type StorefrontProduct = z.output<typeof storefrontProductSchema>;

/** A visible collection of the store. */
export const storefrontCollectionSchema = z.object({
  id: storefrontIdSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  imagePath: z.string().min(1).nullable(),
});

/** A visible collection; see {@link storefrontCollectionSchema}. */
export type StorefrontCollection = z.output<typeof storefrontCollectionSchema>;

/** The store's visible collections, by position (`GET /store/collections`). */
export const storefrontCollectionListSchema = z.object({ items: z.array(storefrontCollectionSchema) });

/** The store's visible collections; see {@link storefrontCollectionListSchema}. */
export type StorefrontCollectionList = z.output<typeof storefrontCollectionListSchema>;

/** A collection page: the collection and one page of its listed products (`GET /store/collection/:slug`). */
export const storefrontCollectionPageSchema = z.object({
  collection: storefrontCollectionSchema,
  products: storefrontProductPageSchema,
});

/** A collection page; see {@link storefrontCollectionPageSchema}. */
export type StorefrontCollectionPage = z.output<typeof storefrontCollectionPageSchema>;
