import { z } from 'zod';
import {
  CATALOG_MAX_PAGE_SIZE,
  CATALOG_PAGE_SIZE,
  INT_COLUMN_MAX,
  PRODUCT_LIST_TABS,
  PRODUCT_SEARCH_MAX,
} from './constants';
import { hasBidiControl, hasControlCharacter } from '../text/control-characters';
import { catalogObject, catalogRefIdListSchema, catalogRefIdSchema, invalidCatalogInput } from './fields';

/** The query object without its null or empty fields; anything that is not an object is left for the schema to refuse. */
function withoutUnsetFields(query: unknown): unknown {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) return query;
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== null && value !== ''));
}

// Capped like an int column: a larger offset is no page anyone reads, and Postgres refuses an OFFSET past bigint.
const pageSkipSchema = z.coerce
  .number(invalidCatalogInput)
  .int(invalidCatalogInput)
  .min(0, invalidCatalogInput)
  .max(INT_COLUMN_MAX, invalidCatalogInput)
  .default(0);

const pageTakeSchema = z.coerce
  .number(invalidCatalogInput)
  .int(invalidCatalogInput)
  .min(1, invalidCatalogInput)
  .max(CATALOG_MAX_PAGE_SIZE, invalidCatalogInput)
  .default(CATALOG_PAGE_SIZE);

const productListFieldsSchema = catalogObject({
  tab: z.enum(PRODUCT_LIST_TABS, invalidCatalogInput).default('all'),
  // A NUL would reach the `contains` filter and fail in Postgres with a 500 (#171).
  q: z
    .string(invalidCatalogInput)
    .trim()
    .max(PRODUCT_SEARCH_MAX, invalidCatalogInput)
    .refine((value) => !hasControlCharacter(value) && !hasBidiControl(value), invalidCatalogInput)
    .optional(),
  collectionId: catalogRefIdSchema.optional(),
  brandId: catalogRefIdSchema.optional(),
  tagId: catalogRefIdSchema.optional(),
  skip: pageSkipSchema,
  take: pageTakeSchema,
});

/**
 * A page of the admin product list (AC4). It may come as a REST query string; a null field (an unset GraphQL
 * variable) or an empty one means "not asked", and a blank search is no search. The search, the tab and the filters
 * combine with AND (D2123).
 */
export const productListQuerySchema = z
  .preprocess(withoutUnsetFields, productListFieldsSchema)
  .transform(({ q, ...query }) => (q === undefined || q === '' ? query : { ...query, q }));

export type ProductListQueryInput = z.input<typeof productListFieldsSchema>;
export type ProductListQuery = z.output<typeof productListQuerySchema>;

/** "Stop orders" / "Resume orders" of sold-out products (D2108); an empty list means every sold-out product. */
export const soldOutOrdersInputSchema = catalogObject({
  productIds: catalogRefIdListSchema(CATALOG_MAX_PAGE_SIZE).default([]),
});

export type SoldOutOrdersCommand = z.output<typeof soldOutOrdersInputSchema>;

const mediaListFieldsSchema = catalogObject({ skip: pageSkipSchema, take: pageTakeSchema });

/**
 * A page of the business's media library, newest first (D2113). Like the product list it may come as a REST query
 * string, and a null field (an unset GraphQL variable) or no options at all mean the first page.
 */
export const mediaListQuerySchema = z.preprocess(
  (query: unknown) => withoutUnsetFields(query ?? {}),
  mediaListFieldsSchema,
);

export type MediaListQuery = z.output<typeof mediaListQuerySchema>;
