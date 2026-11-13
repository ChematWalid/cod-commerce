/** Longest casefolded role name: casefolding can lengthen a name beyond its 60 characters (D71). */
export const ROLE_NAME_KEY_MAX_LENGTH = 240;
/** Longest built-in role key column value. */
export const BUILT_IN_KEY_MAX_LENGTH = 32;
/** Longest binding scope: `all` or a snowflake store id. */
export const BINDING_SCOPE_MAX_LENGTH = 20;
/** Longest member store-access column value. */
export const STORE_ACCESS_MAX_LENGTH = 10;
/** Longest activity action. */
export const ACTIVITY_ACTION_MAX_LENGTH = 64;
/** Longest activity entity type. */
export const ACTIVITY_ENTITY_TYPE_MAX_LENGTH = 32;
/** Longest activity entity id. */
export const ACTIVITY_ENTITY_ID_MAX_LENGTH = 32;
/** Longest activity summary. */
export const ACTIVITY_SUMMARY_MAX_LENGTH = 255;
/** Longest client address kept on an activity row. */
export const ACTIVITY_IP_MAX_LENGTH = 64;
/** Longest user agent kept on an activity row. */
export const ACTIVITY_USER_AGENT_MAX_LENGTH = 255;

/** The binding scope of a role on every store of the business (D53). */
export const ALL_STORES_SCOPE = 'all';

/** A binding's reach: every store of the business, or one store id (D53). */
export type BindingScope = string;

/** Which stores a member's role applies to (D54). */
export type MemberStoreAccess = 'all' | 'selected';

/** The code of the Vendure Role projecting a business role on `scope`. */
export const vendureRoleCode = (businessRoleId: string, scope: BindingScope): string => `br-${businessRoleId}-${scope}`;

/** The stock permission every Vendure Role of a merchant holds (D59); `RoleService` adds it on every write. */
export const ENGINE_BASE_PERMISSION = 'Authenticated';
/** How many businesses one page of the converge walks (D57). */
export const CONVERGE_PAGE_SIZE = 200;

/** The activity page size when the caller names none (D65). */
export const ACTIVITY_DEFAULT_PAGE_SIZE = 50;
/** The most activity rows one page holds. */
export const ACTIVITY_MAX_PAGE_SIZE = 100;
/** A diff whose JSON text is longer than this is replaced by `{ truncated: true }` (D66). */
export const ACTIVITY_DIFF_MAX_BYTES = 16 * 1024;
/** What replaces the value of a sensitive key in a diff. */
export const REDACTED_VALUE = '[REDACTED]';
/** What replaces a branch of a diff nested deeper than {@link DIFF_MAX_DEPTH}, or that refers to itself. */
export const DIFF_OMITTED_VALUE = '[OMITTED]';
/** The deepest nesting of a diff that is kept. */
export const DIFF_MAX_DEPTH = 12;
/** The longest diff key that is read for secret terms; a longer one is redacted unread (D800). */
export const DIFF_MAX_KEY_LENGTH = 256;
/** How long one cached-session delete may take before it is logged and given up (D55). */
export const SESSION_CACHE_DELETE_TIMEOUT_MS = 1000;
/** How long after the first delete the second one runs, for a reader that loaded before the commit (D55). */
export const SESSION_REDELETE_DELAY_MS = 500;
/** How long a process must stay up after a flush for its delayed repeat to finish (D55). */
export const SESSION_FLUSH_SETTLE_MS = SESSION_REDELETE_DELAY_MS + SESSION_CACHE_DELETE_TIMEOUT_MS;
/** Largest Vendure administrator id (a Postgres `integer`); a larger one is never a real id (D68). */
export const MAX_VENDURE_ID = 2147483647;
