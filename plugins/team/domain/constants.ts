import { COMMISSION_NAME_MAX_LENGTH, TEAM_EMAIL_MAX_LENGTH } from '@cod/shared';

/** Longest stored email address: the invite body's own cap, so a valid body always fits the column. */
export const EMAIL_MAX_LENGTH = TEAM_EMAIL_MAX_LENGTH;
/** Column width of a member status, a store access kind or a commission value kind. */
export const SHORT_KIND_MAX_LENGTH = 10;
/** Column width of a commission basis. */
export const COMMISSION_BASIS_MAX_LENGTH = 32;
/** Room for a commission name's case-folded key: folding can lengthen a name (`ß` becomes `ss`). */
export const COMMISSION_NAME_KEY_MAX_LENGTH = COMMISSION_NAME_MAX_LENGTH * 4;
/** Column width of an email locale (`ar`, `en`). */
export const LOCALE_MAX_LENGTH = 2;
/** Random bytes in one invitation token: 256 bits, so the stored hash needs no secret key (D205). */
export const INVITATION_TOKEN_BYTES = 32;
/** Length of a SHA-256 digest in hex, the only form a token is stored in (D205). */
export const TOKEN_HASH_HEX_LENGTH = 64;
/** Businesses the member converge reads per page (tenancy serves at most 500). */
export const MEMBER_CONVERGE_PAGE_SIZE = 100;
/** Orders shown for every member until orders exist (P4.S1 counts them). */
export const ORDER_COUNT_PLACEHOLDER = 0;
