import { z } from 'zod';
import { INT_COLUMN_MAX } from '../catalog/constants';
import { FEE_GROUP_LIST_MAX_TAKE, FEE_GROUP_LIST_PAGE_SIZE, FEE_GROUP_NAME_MAX } from './constants';
import { deliveryIssue as issue, isCleanLine } from './schema-parts';

const DECIMAL_DIGITS = /^\d+$/;

/** A page number: a number, or a decimal string of a REST query read as one. */
const pageNumberSchema = (min: number, max: number) =>
  z
    .union([z.number(issue), z.string(issue).regex(DECIMAL_DIGITS, issue).transform(Number)], issue)
    .pipe(z.number(issue).int(issue).min(min, issue).max(max, issue));

/** The query object without its null or empty fields; anything else is left for the schema to refuse. */
function withoutUnsetFields(query: unknown): unknown {
  const source = query ?? {};
  if (typeof source !== 'object' || Array.isArray(source)) return source;
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== null && value !== ''));
}

const listFieldsSchema = z.object(
  {
    skip: pageNumberSchema(0, INT_COLUMN_MAX).default(0),
    take: pageNumberSchema(1, FEE_GROUP_LIST_MAX_TAKE).default(FEE_GROUP_LIST_PAGE_SIZE),
    search: z.string(issue).trim().max(FEE_GROUP_NAME_MAX, issue).refine(isCleanLine, issue).optional(),
  },
  issue,
);

/** A page of the store's fee groups, newest first; it may come as a REST query string, a blank search is none. */
export const deliveryFeeGroupListQuerySchema = z
  .preprocess(withoutUnsetFields, listFieldsSchema)
  .transform(({ search, ...query }) => (search === undefined || search === '' ? query : { ...query, search }));

/** A parsed page query of the fee-group list. */
export type DeliveryFeeGroupListQuery = z.output<typeof deliveryFeeGroupListQuerySchema>;

/** One fee group as the list shows it: name, carrier (`null` = "No carrier") and creation date (ISO 8601). */
export const deliveryFeeGroupSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  carrierId: z.string().nullable(),
  isPlatformDefault: z.boolean(),
  createdAt: z.iso.datetime(),
});

/** One fee group of the list. */
export type DeliveryFeeGroupSummary = z.output<typeof deliveryFeeGroupSummarySchema>;

/** A page of the store's fee groups and how many the store has in all (with the search). */
export const deliveryFeeGroupPageSchema = z.object({
  items: z.array(deliveryFeeGroupSummarySchema),
  totalItems: z.number().int().min(0),
});

/** A page of the store's fee groups. */
export type DeliveryFeeGroupPage = z.output<typeof deliveryFeeGroupPageSchema>;
