import { z } from 'zod';
import { STOREFRONT_CACHE_TAG_PATTERN } from './cache-tags';

/** Most tags one revalidate call carries: the api's worker sends a few per event, the storefront refuses more. */
export const STOREFRONT_REVALIDATE_MAX_TAGS = 100;

/**
 * The body of the signed `POST {STOREFRONT_REVALIDATE_PATH}` the api's revalidate worker sends (D3211): storefront
 * cache tags only, each exactly as {@link STOREFRONT_CACHE_TAG_PATTERN} builds it, nothing else.
 */
export const storefrontRevalidateBodySchema = z
  .object({
    tags: z.array(z.string().regex(STOREFRONT_CACHE_TAG_PATTERN)).min(1).max(STOREFRONT_REVALIDATE_MAX_TAGS),
  })
  .strict();

/** A valid revalidate body. */
export type StorefrontRevalidateBody = z.output<typeof storefrontRevalidateBodySchema>;
