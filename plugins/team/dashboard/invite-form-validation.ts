import {
  emailSchema,
  type InviteMemberInput,
  SALARY_MAX_DZD,
  type StoreAccessKind,
  type TeamEmailLocale,
  type UpdateMemberInput,
} from '@cod/shared';

/** The grant and pay terms the invite and edit dialogs share; the salary is the text as typed. */
export interface MemberGrantDraft {
  readonly roleIds: readonly string[];
  readonly storeAccess: StoreAccessKind;
  readonly storeIds: readonly string[];
  readonly baseSalary: string;
  readonly commissionConfigIds: readonly string[];
}

export interface InviteDraft extends MemberGrantDraft {
  readonly email: string;
}

export type InviteField = 'email' | 'roleIds' | 'storeIds' | 'baseSalary';

/** Each invalid field and the catalogue id of its message. */
export type InviteErrors = Partial<Record<InviteField, string>>;

const EMAIL_ERROR_ID = 'team.invite-error-email';
const ROLES_ERROR_ID = 'team.invite-error-roles';
const STORES_ERROR_ID = 'team.invite-error-stores';
const SALARY_ERROR_ID = 'team.invite-error-salary';

/** Whole DZD only (ADR 0004): digits, nothing else. */
const WHOLE_NUMBER = /^\d+$/;

export function emptyInviteDraft(): InviteDraft {
  return { email: '', roleIds: [], storeAccess: 'all', storeIds: [], baseSalary: '', commissionConfigIds: [] };
}

/** The salary as whole DZD, or null when the text is not a whole amount from 0 to the cap. */
export function salaryOf(text: string): number | null {
  const trimmed = text.trim();
  if (!WHOLE_NUMBER.test(trimmed)) return null;
  const amount = Number(trimmed);
  return amount <= SALARY_MAX_DZD ? amount : null;
}

/** The gaps of a grant: no role, "only these stores" with none, a salary that is not whole DZD. */
export function grantErrorsOf(draft: MemberGrantDraft): InviteErrors {
  const errors: { -readonly [K in InviteField]?: string } = {};
  if (draft.roleIds.length === 0) errors.roleIds = ROLES_ERROR_ID;
  if (draft.storeAccess === 'selected' && draft.storeIds.length === 0) errors.storeIds = STORES_ERROR_ID;
  if (salaryOf(draft.baseSalary) === null) errors.baseSalary = SALARY_ERROR_ID;
  return errors;
}

/** The gaps of an invite: the grant's and a malformed email. The server checks again; this only guides the form. */
export function inviteErrorsOf(draft: InviteDraft): InviteErrors {
  const email = emailSchema.safeParse(draft.email).success ? {} : { email: EMAIL_ERROR_ID };
  return { ...email, ...grantErrorsOf(draft) };
}

const hasNoErrors = (errors: InviteErrors): boolean => Object.keys(errors).length === 0;

function grantInputOf(draft: MemberGrantDraft, salary: number) {
  return {
    roleIds: [...draft.roleIds],
    storeAccess: draft.storeAccess,
    storeIds: draft.storeAccess === 'all' ? [] : [...draft.storeIds],
    baseSalary: salary,
    commissionConfigIds: [...draft.commissionConfigIds],
  };
}

/** The `inviteMember` input of a valid draft, the email written to `locale`; null while the draft has gaps. */
export function inviteInputOf(draft: InviteDraft, locale: TeamEmailLocale): InviteMemberInput | null {
  const salary = salaryOf(draft.baseSalary);
  if (!hasNoErrors(inviteErrorsOf(draft)) || salary === null) return null;
  return { email: emailSchema.parse(draft.email), ...grantInputOf(draft, salary), locale };
}

/** The `updateTeamMember` input of a valid edit draft; null while it has gaps. */
export function memberUpdateInputOf(draft: MemberGrantDraft): UpdateMemberInput | null {
  const salary = salaryOf(draft.baseSalary);
  if (!hasNoErrors(grantErrorsOf(draft)) || salary === null) return null;
  return grantInputOf(draft, salary);
}
