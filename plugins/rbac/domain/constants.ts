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
