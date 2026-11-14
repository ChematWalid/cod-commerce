import { LOGO_MAX_BYTES } from '../auth/constants';

/** Lifecycle of a product: listed, reachable only by its landing page, or never public (D2109). */
export const PRODUCT_STATUSES = ['active', 'hidden', 'draft'] as const;
/** Kinds of product; append-only (P2.S2 appends `pack`, D2126). */
export const PRODUCT_TYPES = ['physical'] as const;
/** Tabs of the admin product list; `draft` lists drafts only. */
export const PRODUCT_LIST_TABS = ['all', 'draft'] as const;

/** Most highlights one product shows (brief AC3). */
export const MAX_PRODUCT_HIGHLIGHTS = 6;

/** Largest media file accepted, the same as a business logo (D2113). */
export const MEDIA_MAX_BYTES = LOGO_MAX_BYTES;
/** Image formats the media library accepts, recognised by content; SVG is never one (D2113). */
export const MEDIA_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;

/** Between the product name and the option values in a variant name: "Product - Red / S" (D2124). */
export const VARIANT_NAME_SEPARATOR = ' - ';
/** Between two option values in a variant name. */
export const OPTION_VALUE_SEPARATOR = ' / ';
/** Between the product SKU and the variant number: `<sku>-n`. */
export const SKU_SUFFIX_SEPARATOR = '-';

/** Matrix caps (D2124). */
export const MAX_OPTION_GROUPS = 3;
export const MAX_OPTION_VALUES = 20;
export const MAX_VARIANTS = 100;

/**
 * Most brands, most tags and most highlights one store keeps, each kind on its own. The lists answer every entry of
 * the store unpaged, so a create past this cap is refused (P2.S1 Task 12 review).
 */
export const MAX_TAXONOMY_ENTRIES_PER_STORE = 500;

/** Most order managers one product names (D2114). */
export const MAX_ORDER_MANAGERS = 20;
/** Most custom attributes one product carries. */
export const MAX_CUSTOM_ATTRIBUTES = 20;
/** Highest minimum quantity or quantity step of a product. */
export const QUANTITY_RULE_MAX = 10_000;

/** Longest stored text of each catalog field. */
export const PRODUCT_TITLE_MAX = 255;
export const SKU_MAX = 64;
export const BARCODE_MAX = 64;
export const SLUG_MAX = 255;
/**
 * Longest text the slug availability check reads. It only keeps the query small: the slug rule (trimmed, at most
 * `SLUG_MAX` typed and stored) then decides, so surrounding spaces may push the raw text past `SLUG_MAX`.
 */
export const SLUG_QUERY_MAX = 4 * SLUG_MAX;
export const NAME_IN_DELIVERY_MAX = 100;
export const META_TITLE_MAX = 70;
export const META_DESCRIPTION_MAX = 160;
export const BRAND_NAME_MAX = 100;
export const TAG_NAME_MAX = 50;
export const HIGHLIGHT_TEXT_MAX = 120;
export const LABEL_MAX = 40;
export const CARD_CAPTION_MAX = 80;
export const OPTION_NAME_MAX = 50;
export const OPTION_VALUE_MAX = 50;
/** Longest product description, as HTML before sanitising (D2122). */
export const DESCRIPTION_MAX = 20_000;
/** Longest admin search text of the product list. */
export const PRODUCT_SEARCH_MAX = 100;
/**
 * Longest id a catalog body may carry. Ids are parsed at the API boundary, where a malformed one answers "not found"
 * (D2136); this only keeps bodies small. A snowflake has at most 19 digits.
 */
export const CATALOG_ID_MAX_LENGTH = 32;

/** Rows per page of catalog lists, and the most a client may ask for. */
export const CATALOG_PAGE_SIZE = 20;
export const CATALOG_MAX_PAGE_SIZE = 100;

/** Input bounds against oversized payloads (D2141). */
export const MAX_PRODUCT_ASSETS = 20;
export const MAX_PRODUCT_TAGS = 20;
export const MAX_PRODUCT_COLLECTIONS = 20;
export const CUSTOM_ATTRIBUTE_NAME_MAX = 50;
export const CUSTOM_ATTRIBUTE_VALUE_MAX = 255;

/** Largest integer a Postgres `int` column holds: the bound of money (ADR 0004) and of product sizes. */
export const INT_COLUMN_MAX = 2_147_483_647;

/** One of the {@link PRODUCT_STATUSES}. */
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
/** One of the {@link PRODUCT_TYPES}. */
export type ProductType = (typeof PRODUCT_TYPES)[number];
/** One of the {@link PRODUCT_LIST_TABS}. */
export type ProductListTab = (typeof PRODUCT_LIST_TABS)[number];
/** One of the {@link MEDIA_IMAGE_MIME_TYPES}. */
export type MediaImageMimeType = (typeof MEDIA_IMAGE_MIME_TYPES)[number];
