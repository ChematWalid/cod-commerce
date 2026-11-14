import { z } from 'zod';
import { INT_COLUMN_MAX, SLUG_MAX } from '../catalog/constants';
import { hasControlCharacter } from '../text/control-characters';
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_LIST_MAX_TAKE,
  COLLECTION_LIST_PAGE_SIZE,
  COLLECTION_MAX_MANUAL_PRODUCTS,
  COLLECTION_MODES,
  COLLECTION_POSITION_MAX,
  COLLECTION_PREVIEW_MAX_TAKE,
  COLLECTION_TITLE_MAX,
  COLLECTIONS_PER_STORE_MAX,
} from './constants';
import { COLLECTIONS_ERROR_CODES } from './error-codes';
import {
  collectionRefIdListSchema,
  collectionRefIdSchema,
  collectionTextSchema,
  invalidCollectionInput as issue,
  isCleanLine,
} from './fields';
import { collectionRuleSchema } from './rule';

const tooManyProducts = COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS;

/** A page number as a REST query string writes it: decimal digits only, no sign, hex or exponent. */
const DECIMAL_DIGITS = /^\d+$/;

/** A collection description as HTML, multi-line; sanitised server-side like a product's (D2322). */
const descriptionSchema = z
  .string(issue)
  .max(COLLECTION_DESCRIPTION_MAX, issue)
  .refine((value) => !hasControlCharacter(value, { allowLineBreaks: true }), issue);

/** A slug the merchant typed; a blank one is no slug, so the server derives it from the title (D2319). */
const slugSchema = z
  .string(issue)
  .trim()
  .max(SLUG_MAX, issue)
  .refine(isCleanLine, issue)
  .transform((slug) => (slug === '' ? undefined : slug));

/** A page number in a JSON or GraphQL body: a whole number, never coerced from another type. */
const pageNumberSchema = (min: number, max: number) => z.number(issue).int(issue).min(min, issue).max(max, issue);

/** A page number of a REST query string: a number, or a decimal string read as one. */
const queryPageNumberSchema = (min: number, max: number) =>
  z
    .union([z.number(issue), z.string(issue).regex(DECIMAL_DIGITS, issue).transform(Number)], issue)
    .pipe(pageNumberSchema(min, max));

/** Reads an explicit `null`, which a nullable GraphQL input field may carry, as an absent field. */
const absentWhenNull = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

const collectionFields = {
  title: collectionTextSchema(COLLECTION_TITLE_MAX, issue),
  slug: slugSchema.nullish().transform(absentWhenNull),
  description: descriptionSchema.nullish(),
  featuredAssetId: collectionRefIdSchema.nullish(),
  visible: z.boolean(issue),
  position: z.number(issue).int(issue).min(0, issue).max(COLLECTION_POSITION_MAX, issue),
  mode: z.enum(COLLECTION_MODES, issue),
  rule: collectionRuleSchema.nullish().transform(absentWhenNull),
};

type ModeAndRule = { readonly mode?: string; readonly rule?: unknown };

/**
 * An automatic collection needs a rule; a manual one takes none (D2302). Checked only when the mode is sent; a `null`
 * rule has already been read as no rule.
 */
function refuseRuleMismatch({ mode, rule }: ModeAndRule, context: z.RefinementCtx): void {
  if (mode === 'automatic' && rule === undefined) {
    context.addIssue({ code: 'custom', path: ['rule'], message: COLLECTIONS_ERROR_CODES.RULE_INVALID });
  }
  if (mode === 'manual' && rule !== undefined) {
    context.addIssue({ code: 'custom', path: ['rule'], message: COLLECTIONS_ERROR_CODES.INVALID_INPUT });
  }
}

/** "Create a collection" (D2300): strings in the store's language (D2112). */
export const createStoreCollectionInputSchema = z.object(collectionFields, issue).superRefine(refuseRuleMismatch);

/** "Edit a collection": any field; an absent one stays unchanged, `null` clears the description or the image. */
export const updateStoreCollectionInputSchema = z
  .object(collectionFields, issue)
  .partial()
  .superRefine(refuseRuleMismatch);

/** The hand-ordered products of a manual collection; the list replaces the stored one (D2318). */
export const setStoreCollectionProductsInputSchema = z.object(
  { productIds: collectionRefIdListSchema(COLLECTION_MAX_MANUAL_PRODUCTS, tooManyProducts) },
  issue,
);

/** The manual collections one product belongs to, from the product editor (D2324). */
export const setStoreProductCollectionsInputSchema = z.object(
  { productId: collectionRefIdSchema, collectionIds: collectionRefIdListSchema(COLLECTIONS_PER_STORE_MAX) },
  issue,
);

/** An unsaved rule and the page of matches to show (D2331). */
export const previewStoreCollectionInputSchema = z.object(
  {
    rule: collectionRuleSchema,
    skip: pageNumberSchema(0, INT_COLUMN_MAX).default(0),
    take: pageNumberSchema(1, COLLECTION_PREVIEW_MAX_TAKE).default(COLLECTION_PREVIEW_MAX_TAKE),
  },
  issue,
);

/** The query object without its null or empty fields; anything else is left for the schema to refuse. */
function withoutUnsetFields(query: unknown): unknown {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) return query;
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== null && value !== ''));
}

const listQueryFieldsSchema = z.object(
  {
    skip: queryPageNumberSchema(0, COLLECTIONS_PER_STORE_MAX).default(0),
    take: queryPageNumberSchema(1, COLLECTION_LIST_MAX_TAKE).default(COLLECTION_LIST_PAGE_SIZE),
    search: z.string(issue).trim().max(COLLECTION_TITLE_MAX, issue).refine(isCleanLine, issue).optional(),
  },
  issue,
);

/** A page of the admin collection list; it may come as a REST query string, and a blank search is no search. */
export const storeCollectionListQuerySchema = z
  .preprocess(withoutUnsetFields, listQueryFieldsSchema)
  .transform(({ search, ...query }) => (search === undefined || search === '' ? query : { ...query, search }));

export type CreateStoreCollectionInput = z.input<typeof createStoreCollectionInputSchema>;
export type CreateStoreCollectionCommand = z.output<typeof createStoreCollectionInputSchema>;
export type UpdateStoreCollectionInput = z.input<typeof updateStoreCollectionInputSchema>;
export type UpdateStoreCollectionCommand = z.output<typeof updateStoreCollectionInputSchema>;
export type SetStoreCollectionProductsCommand = z.output<typeof setStoreCollectionProductsInputSchema>;
export type SetStoreProductCollectionsCommand = z.output<typeof setStoreProductCollectionsInputSchema>;
export type PreviewStoreCollectionCommand = z.output<typeof previewStoreCollectionInputSchema>;
export type StoreCollectionListQuery = z.output<typeof storeCollectionListQuerySchema>;
