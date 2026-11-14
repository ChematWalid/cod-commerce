/** How a collection gets its products: picked and ordered by hand, or matched by a rule (D2302). */
export const COLLECTION_MODES = ['manual', 'automatic'] as const;
export type CollectionMode = (typeof COLLECTION_MODES)[number];

/** `all`: every condition holds; `any`: at least one does (D2303). */
export const RULE_MATCHES = ['all', 'any'] as const;
export type RuleMatch = (typeof RULE_MATCHES)[number];

/** The product facts a rule condition can test (D2303). */
export const RULE_FIELDS = ['tag', 'brand', 'price', 'on_sale', 'title', 'option'] as const;
export type RuleField = (typeof RULE_FIELDS)[number];

/** The operators each field accepts, in the order the rule builder offers them. */
export const RULE_OPERATORS_BY_FIELD = {
  tag: ['is_any_of', 'is_not'],
  brand: ['is_any_of', 'is_not'],
  price: ['between'],
  on_sale: ['is'],
  title: ['contains', 'not_contains'],
  option: ['is_any_of', 'is_not'],
} as const satisfies { readonly [F in RuleField]: readonly string[] };

/** The shape version of a stored rule; a new shape bumps it and migrates the stored rules (D2303). */
export const COLLECTION_RULE_VERSION = 1;

/** The version of {@link normalForMatch}'s folding; a change bumps it and reconciles every store (D2305, D2336). */
export const NORMAL_FORM_VERSION = 1;

/** Caps of D2322. */
export const COLLECTION_RULE_MAX_CONDITIONS = 20;
export const COLLECTION_RULE_MAX_VALUES = 50;
export const COLLECTION_RULE_TEXT_MAX = 100;
export const COLLECTION_RULE_MAX_TEXT_VALUES = 10;
export const COLLECTION_OPTION_NAME_MAX = 60;
export const COLLECTION_TITLE_MAX = 120;
export const COLLECTION_DESCRIPTION_MAX = 2_000;
export const COLLECTION_MAX_MANUAL_PRODUCTS = 500;
export const COLLECTIONS_PER_STORE_MAX = 500;
export const COLLECTION_POSITION_MAX = 9_999;
export const COLLECTION_PREVIEW_MAX_TAKE = 50;
export const COLLECTION_SYNC_MAX_PRODUCTS = 2_000;

/** Page sizes of the admin collection list. */
export const COLLECTION_LIST_PAGE_SIZE = 20;
export const COLLECTION_LIST_MAX_TAKE = 100;
