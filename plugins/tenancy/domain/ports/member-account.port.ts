import type { Snowflake } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** A team member's account. `password` goes to the commerce engine only: never logged or stored by us. */
export interface MemberAccountRequest {
  readonly businessId: Snowflake;
  readonly emailAddress: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
}

/** The commerce engine's ids of a created member account. */
export interface MemberAccount {
  readonly administratorId: number;
  readonly userId: number;
}

/** The commerce engine's administrator accounts of team members (D202). */
export interface MemberAccountPort {
  /**
   * Creates an administrator of the business holding no role: access is granted separately (D204).
   *
   * @throws {MemberEmailTakenError} when a live administrator already holds the address.
   */
  create(ctx: OperationContext, request: MemberAccountRequest): Promise<MemberAccount>;
  /** The business of a live administrator, or `null` when there is none or it belongs to no business. */
  businessIdOf(ctx: OperationContext, administratorId: number): Promise<Snowflake | null>;
  /** Soft-deletes the administrator and its user, and ends its sessions. */
  softDelete(ctx: OperationContext, administratorId: number): Promise<void>;
}
