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
  MAX_OPEN_ORDERS_LIMIT,
  MEMBER_NAME_MAX_LENGTH,
  SALARY_MAX_DZD,
  STORE_ACCESS_KINDS,
  TEAM_EMAIL_LOCALES,
} from './constants';
import { TEAM_ERROR_CODES } from './error-codes';

const invalid = { message: TEAM_ERROR_CODES.INVALID_INPUT };
const idSchema = z.string().refine(isSnowflake, invalid);
const idListSchema = z.array(idSchema);
const roleIdsSchema = idListSchema.min(1);
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
    storeIds: idListSchema.default([]),
    baseSalary: salarySchema,
    commissionConfigIds: idListSchema.default([]),
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
  storeIds: idListSchema.optional(),
  baseSalary: salarySchema.optional(),
  commissionConfigIds: idListSchema.optional(),
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
    storeIds: idListSchema.default([]),
  })
  .refine(withinValueCap, { message: TEAM_ERROR_CODES.INVALID_INPUT, path: ['value'] })
  .refine(({ scope, storeIds }) => hasConsistentStores({ storeAccess: scope, storeIds }), storeRule)
  .transform((input) => (input.scope === 'all' ? { ...input, storeIds: [] } : input));

export type CommissionConfigInput = z.input<typeof commissionConfigSchema>;
export type CommissionConfigCommand = z.output<typeof commissionConfigSchema>;
