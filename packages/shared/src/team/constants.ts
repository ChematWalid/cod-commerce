const SECOND_MS = 1000;
const DAY_MS = 24 * 3600 * SECOND_MS;
const INVITATION_TTL_DAYS = 7;

/** How long an invitation link works (D205). */
export const INVITATION_TTL_MS = INVITATION_TTL_DAYS * DAY_MS;
/** Minimum wait between two sends of one invitation (D205). */
export const INVITATION_RESEND_COOLDOWN_MS = 60 * SECOND_MS;
/** Resends allowed for one invitation (D205). */
export const INVITATION_MAX_RESENDS = 5;
/** Open invitations one business may hold at once, so the platform is not a mail relay (D205). */
export const MAX_PENDING_INVITATIONS = 50;
/** Longest invitation token the server will read; a real one is far shorter. */
export const INVITATION_TOKEN_MAX_LENGTH = 128;

/** Highest monthly base salary, in whole DZD (ADR 0004). */
export const SALARY_MAX_DZD = 100_000_000;
/** Highest "max open orders" limit a member can be given. */
export const MAX_OPEN_ORDERS_LIMIT = 10_000;
/** Longest client idempotency key of a salary payment (D212). */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 64;
/** Most roles one grant (invite or edit) may name; bounds the stored grant and its lookups. */
export const MAX_ROLES_PER_GRANT = 20;
/** Most stores one grant or commission may name when the access is `selected`. */
export const MAX_STORES_PER_GRANT = 200;
/** Most commission configs one member may be linked to. */
export const MAX_COMMISSIONS_PER_MEMBER = 20;
/** Longest first or last name of a member. */
export const MEMBER_NAME_MAX_LENGTH = 100;

/** What a commission is earned on. */
export const COMMISSION_BASES = ['per-confirmed-order', 'per-delivered-order'] as const;
/** How a commission value reads: whole DZD, or a percent stored in basis points. */
export const COMMISSION_VALUE_KINDS = ['fixed', 'percent'] as const;
/** 100 % in basis points: the highest percent commission. */
export const COMMISSION_PERCENT_MAX_BPS = 10_000;
/** Highest fixed commission, in whole DZD. */
export const COMMISSION_FIXED_MAX_DZD = SALARY_MAX_DZD;
/** Longest commission config name. */
export const COMMISSION_NAME_MAX_LENGTH = 60;

/** Which stores a grant or a commission covers. */
export const STORE_ACCESS_KINDS = ['all', 'selected'] as const;
/** Languages an invitation email can be written in. */
export const TEAM_EMAIL_LOCALES = ['ar', 'en'] as const;
/** Language of an invitation email when the inviter picks none. */
export const DEFAULT_TEAM_EMAIL_LOCALE = 'ar';

/** Lifecycle of a team member. */
export const MEMBER_STATUSES = ['invited', 'active', 'inactive'] as const;
/** Tabs of the members list; `pending` shows `invited` members. */
export const MEMBER_TABS = ['all', 'active', 'pending', 'inactive'] as const;
/** Rows per page of the members list. */
export const MEMBERS_PAGE_SIZE = 25;

/** One of the {@link COMMISSION_BASES}. */
export type CommissionBasis = (typeof COMMISSION_BASES)[number];
/** One of the {@link COMMISSION_VALUE_KINDS}. */
export type CommissionValueKind = (typeof COMMISSION_VALUE_KINDS)[number];
/** One of the {@link STORE_ACCESS_KINDS}. */
export type StoreAccessKind = (typeof STORE_ACCESS_KINDS)[number];
/** One of the {@link TEAM_EMAIL_LOCALES}. */
export type TeamEmailLocale = (typeof TEAM_EMAIL_LOCALES)[number];
/** One of the {@link MEMBER_STATUSES}. */
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
/** One of the {@link MEMBER_TABS}. */
export type MemberTab = (typeof MEMBER_TABS)[number];
