import { z } from 'zod';
import { isSnowflake, type Snowflake } from '../ids/snowflake';
import { PLATFORM_LANGUAGE_CODES, type PlatformLanguageCode } from '../platform/platform-defaults';
import { SOLD_OUT_BEHAVIORS } from '../tenancy/sold-out-behavior';
import { MAX_BUSINESS_ID, type BusinessId } from '../tenancy/tenant-scope';

/** The writing directions a storefront page can take. */
export const STOREFRONT_DIRECTIONS = ['rtl', 'ltr'] as const;

/** One of the {@link STOREFRONT_DIRECTIONS}. */
export type StorefrontDirection = (typeof STOREFRONT_DIRECTIONS)[number];

/** The platform languages written right to left. */
const RTL_LANGUAGES: readonly PlatformLanguageCode[] = ['ar'];

/** Same text form as a snowflake (ADR 0003): decimal, no sign, no leading zero, at most 19 digits. */
const DECIMAL_ID_FORMAT = /^[1-9][0-9]{0,18}$/;

/** The direction a store's language is written in: Arabic right to left, French and English left to right. */
export function directionOf(language: PlatformLanguageCode): StorefrontDirection {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}

const snowflakeSchema = z.custom<Snowflake>((value) => typeof value === 'string' && isSnowflake(value));

const businessIdSchema = z.custom<BusinessId>(
  (value) => typeof value === 'string' && DECIMAL_ID_FORMAT.test(value) && BigInt(value) <= MAX_BUSINESS_ID,
);

/**
 * The store a storefront renders, as `/store/resolve` and `/store/by-id/:id` return it (P3.S2). Fields are additive to
 * the P0.S2b response; `logo` is the old name of `logoPath`, kept for one release (D3203). `logoPath` is a Vendure
 * asset preview path, never a URL. Only active stores are ever returned, so `status` is always `active`.
 */
export const storefrontStoreSchema = z
  .object({
    storeId: snowflakeSchema,
    businessId: businessIdSchema,
    name: z.string().min(1),
    description: z.string(),
    logoPath: z.string().min(1).nullable(),
    logo: z.string().min(1).nullable().optional(),
    language: z.enum(PLATFORM_LANGUAGE_CODES),
    direction: z.enum(STOREFRONT_DIRECTIONS),
    primaryHost: z.string().min(1),
    showAddressField: z.boolean(),
    soldOutBehavior: z.enum(SOLD_OUT_BEHAVIORS),
    status: z.literal('active'),
  })
  .refine((store) => store.direction === directionOf(store.language), { path: ['direction'] });

/** A store as the storefront renders it; see {@link storefrontStoreSchema}. */
export type StorefrontStore = z.output<typeof storefrontStoreSchema>;
