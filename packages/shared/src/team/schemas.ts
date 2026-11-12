import { z } from 'zod';
import { emailSchema, passwordSchema } from '../auth/schemas';
import { isSnowflake } from '../ids/snowflake';
import {
  COMMISSION_BASES,
  COMMISSION_FIXED_MAX_DZD,
  COMMISSION_NAME_MAX_LENGTH,
  COMMISSION_PERCENT_MAX_BPS,
  COMMISSION_VALUE_KINDS,
  DEFAULT_TEAM_EMAIL_LOCALE,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  INVITATION_TOKEN_MAX_LENGTH,
  MAX_COMMISSIONS_PER_MEMBER,
  MAX_OPEN_ORDERS_LIMIT,
  MAX_ROLES_PER_GRANT,
  MAX_STORES_PER_GRANT,
  MEMBER_NAME_MAX_LENGTH,
  MEMBER_SEARCH_MAX_LENGTH,
  MEMBER_TABS,
  SALARY_MAX_DZD,
  STORE_ACCESS_KINDS,
  TEAM_EMAIL_LOCALES,
} from './constants';
import { TEAM_ERROR_CODES } from './error-codes';

const invalid = { message: TEAM_ERROR_CODES.INVALID_INPUT };
const idSchema = z.string().refine(isSnowflake, invalid);
/** A bounded id list with repeats removed, so a body cannot store or look up the same id twice. */
const idListSchema = (max: number, min = 0) =>
  z
    .array(idSchema)
    .min(min, invalid)
    .max(max, invalid)
    .transform((ids) => [...new Set(ids)]);
const roleIdsSchema = idListSchema(MAX_ROLES_PER_GRANT, 1);
const storeIdsSchema = idListSchema(MAX_STORES_PER_GRANT);
const commissionIdsSchema = idListSchema(MAX_COMMISSIONS_PER_MEMBER);
const storeAccessSchema = z.enum(STORE_ACCESS_KINDS);
const salarySchema = z.number().int().min(0).max(SALARY_MAX_DZD);
const memberNameSchema = z.string().trim().min(1).max(MEMBER_NAME_MAX_LENGTH);

interface StoreScoped {
  readonly storeAccess?: (typeof STORE_ACCESS_KINDS)[number];
  readonly storeIds?: readonly string[];
}

/** `selected` names at least one store; store ids never come without a store access. */
function hasConsistentStores({ storeAccess, storeIds }: StoreScoped): boolean {
  if (storeAccess === undefined) return storeIds === undefined;
  return storeAccess === 'all' || (storeIds?.length ?? 0) > 0;
}

/** An `all` access lists no store, whatever the client sent. */
function withoutIgnoredStores<T extends StoreScoped>(input: T): T {
  return input.storeAccess === 'all' ? { ...input, storeIds: [] } : input;
}

const storeRule = { message: TEAM_ERROR_CODES.INVALID_INPUT, path: ['storeIds'] };

/** The body of "invite a member": the grant the invitee gets on accept, and the pay terms. */
export const inviteMemberSchema = z
  .object({
    email: emailSchema,
    roleIds: roleIdsSchema,
    storeAccess: storeAccessSchema,
    storeIds: storeIdsSchema.default([]),
    baseSalary: salarySchema,
    commissionConfigIds: commissionIdsSchema.default([]),
    locale: z.enum(TEAM_EMAIL_LOCALES).default(DEFAULT_TEAM_EMAIL_LOCALE),
  })
  .refine(hasConsistentStores, storeRule)
  .transform(withoutIgnoredStores);

export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type InviteMemberCommand = z.output<typeof inviteMemberSchema>;

/** The public accept form: the token from the link, the invitee's names and a password. */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1).max(INVITATION_TOKEN_MAX_LENGTH),
  firstName: memberNameSchema,
  lastName: memberNameSchema,
  password: passwordSchema,
});

export type AcceptInvitationInput = z.input<typeof acceptInvitationSchema>;
export type AcceptInvitationCommand = z.output<typeof acceptInvitationSchema>;

/** "Pay salary": a client key, so a repeated click books one payment (D212). */
export const payMemberSchema = z.object({
  idempotencyKey: z.string().min(1).max(IDEMPOTENCY_KEY_MAX_LENGTH),
});

export type PayMemberCommand = z.output<typeof payMemberSchema>;

const updateMemberFields = z.object({
  roleIds: roleIdsSchema.optional(),
  storeAccess: storeAccessSchema.optional(),
  storeIds: storeIdsSchema.optional(),
  baseSalary: salarySchema.optional(),
  commissionConfigIds: commissionIdsSchema.optional(),
});

type UpdateMemberFields = z.output<typeof updateMemberFields>;

function changesSomething(input: UpdateMemberFields): boolean {
  const { roleIds, storeAccess, storeIds, baseSalary, commissionConfigIds } = input;
  return [roleIds, storeAccess, storeIds, baseSalary, commissionConfigIds].some((value) => value !== undefined);
}

/** "Edit a member": any of roles, store access, salary and commissions, at least one. */
export const updateMemberSchema = updateMemberFields
  .refine(changesSomething, invalid)
  .refine(hasConsistentStores, storeRule)
  .transform(withoutIgnoredStores);

export type UpdateMemberInput = z.input<typeof updateMemberSchema>;
export type UpdateMemberCommand = z.output<typeof updateMemberSchema>;

/** "Limit": the most open orders a member may hold, or `null` for no limit. */
export const setLimitSchema = z.object({
  maxOpenOrders: z.number().int().min(1).max(MAX_OPEN_ORDERS_LIMIT).nullable(),
});

export type SetLimitCommand = z.output<typeof setLimitSchema>;

/** A percent value is in basis points; a fixed one in whole DZD. */
function withinValueCap({ valueKind, value }: { valueKind: string; value: number }): boolean {
  return value <= (valueKind === 'percent' ? COMMISSION_PERCENT_MAX_BPS : COMMISSION_FIXED_MAX_DZD);
}

/** A commission structure members can be given. */
export const commissionConfigSchema = z
  .object({
    name: z.string().trim().min(1).max(COMMISSION_NAME_MAX_LENGTH),
    basis: z.enum(COMMISSION_BASES),
    valueKind: z.enum(COMMISSION_VALUE_KINDS),
    value: z.number().int().positive(),
    scope: storeAccessSchema,
    storeIds: storeIdsSchema.default([]),
  })
  .refine(withinValueCap, { message: TEAM_ERROR_CODES.INVALID_INPUT, path: ['value'] })
  .refine(({ scope, storeIds }) => hasConsistentStores({ storeAccess: scope, storeIds }), storeRule)
  .transform((input) => (input.scope === 'all' ? { ...input, storeIds: [] } : input));

export type CommissionConfigInput = z.input<typeof commissionConfigSchema>;
export type CommissionConfigCommand = z.output<typeof commissionConfigSchema>;

/**
 * A page of the members list. The page may come as text (a REST query string); a blank search is no search, and the
 * search is matched as plain text, never as a pattern. A null field (an unset GraphQL variable) or an empty one (`?page=`)
 * means the field was not asked, so it takes its default.
 */
const listMembersFieldsSchema = z.object({
  tab: z.enum(MEMBER_TABS).default('all'),
  search: z.string().trim().max(MEMBER_SEARCH_MAX_LENGTH).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** The query object without its null or empty fields; anything that is not an object is left for the schema to refuse. */
function withoutUnsetFields(query: unknown): unknown {
  if (typeof query !== 'object' || query === null || Array.isArray(query)) return query;
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== null && value !== ''));
}

export const listMembersQuerySchema = z
  .preprocess(withoutUnsetFields, listMembersFieldsSchema)
  .transform(({ search, ...query }) => (search === undefined || search === '' ? query : { ...query, search }));

export type ListMembersQueryInput = z.input<typeof listMembersFieldsSchema>;
export type ListMembersQuery = z.output<typeof listMembersQuerySchema>;
