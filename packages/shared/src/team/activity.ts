import { z } from 'zod';
import { isSnowflake } from '../ids/snowflake';
import { COMMISSION_NAME_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from './constants';

/** Member fields a `team.*` activity row may name as changed; it never carries their values (D216). */
export const TEAM_MEMBER_ACTIVITY_FIELDS = [
  'roles',
  'storeAccess',
  'storeIds',
  'baseSalary',
  'commissionConfigIds',
  'maxOpenOrders',
  'receivingOrders',
  'status',
] as const;

/** Commission config fields a `team.commission.*` activity row may name as changed, never their values (D216). */
export const TEAM_COMMISSION_ACTIVITY_FIELDS = ['name', 'basis', 'valueKind', 'value', 'scope', 'storeIds'] as const;

const snowflake = z.string().refine(isSnowflake);
/** A person's name, never an email address: an invited member has no name yet and logs `null`. */
const displayName = z
  .string()
  .trim()
  .min(1)
  .max(MEMBER_NAME_MAX_LENGTH)
  .refine((name) => !name.includes('@'));

/**
 * The whole diff of a `team.member.*`, `team.invitation.*` or `team.salary.paid` activity row (D216). Strict: a
 * salary, a paid amount, a commission value, an email or a token cannot be added, because the activity log is
 * readable with `settings.activity-log.view` alone while salaries need `team.members.edit` (D207).
 */
export const teamMemberActivityDiffSchema = z
  .object({
    memberId: snowflake,
    displayName: displayName.nullable(),
    changedFields: z.array(z.enum(TEAM_MEMBER_ACTIVITY_FIELDS)),
  })
  .strict();

/** The whole diff of a `team.commission.*` activity row (D216): which config and which fields, never the value. */
export const teamCommissionActivityDiffSchema = z
  .object({
    commissionConfigId: snowflake,
    name: z.string().trim().min(1).max(COMMISSION_NAME_MAX_LENGTH),
    changedFields: z.array(z.enum(TEAM_COMMISSION_ACTIVITY_FIELDS)),
  })
  .strict();

/** A valid {@link teamMemberActivityDiffSchema} diff. */
export type TeamMemberActivityDiff = z.infer<typeof teamMemberActivityDiffSchema>;
/** A valid {@link teamCommissionActivityDiffSchema} diff. */
export type TeamCommissionActivityDiff = z.infer<typeof teamCommissionActivityDiffSchema>;
