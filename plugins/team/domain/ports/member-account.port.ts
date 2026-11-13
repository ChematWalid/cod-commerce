import type { TeamEmailLocale, TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** The account an invitee creates on accept. */
export interface NewMemberAccount {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
}

/** Administrator accounts of members, kept by tenancy and auth (D202, D203). */
export interface MemberAccountPort {
  /** Refuses an address that already has an account anywhere; holds the address claim until the transaction ends. */
  assertEmailFree(ctx: OperationContext, email: string): Promise<void>;

  /** Creates an administrator of the business with no role, and returns its id. */
  create(ctx: OperationContext, scope: TenantScope, account: NewMemberAccount): Promise<number>;

  /** Marks the invited address as verified (the mailed token proved it) and sets the email language. */
  markVerified(ctx: OperationContext, administratorId: number, locale: TeamEmailLocale): Promise<void>;

  /** Soft-deletes the member's administrator and ends its sessions. */
  softDelete(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<void>;
}
