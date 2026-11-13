import type { TenantScope } from '@cod/shared';
import type { MemberGrant } from '../member-grant';
import type { ActorReachView } from '../member-reach';
import type { TeamActor } from '../team-actor';
import type { OperationContext } from './operation-context';

/**
 * Roles and store access of members, kept by rbac (D204). A refusal comes back as rbac's own `DomainError` (privilege
 * exceeded, role not found, store not accessible, ...): Team's API maps those codes beside its own.
 */
export interface MemberAccessPort {
  /** Refuses a grant the actor could not make, before anyone holds it (D208). Writes nothing. */
  preview(ctx: OperationContext, actor: TeamActor, grant: MemberGrant): Promise<void>;

  /**
   * Refuses to act on a member holding `grant` when the actor could not change that holder (D60.4, D60.7). The grant is
   * judged by what remains of it: a role deleted since grants nothing, an archived store still counts. Writes nothing.
   */
  assertMayChangeHolder(ctx: OperationContext, actor: TeamActor, grant: MemberGrant): Promise<void>;

  /** Gives the administrator exactly `grant`, as `actor`, with rbac's escalation rules; an empty role list clears it. */
  setAccess(ctx: OperationContext, actor: TeamActor, administratorId: number, grant: MemberGrant): Promise<void>;

  /** Signs the administrators out of stale sessions after their access changed; call after commit. */
  flush(administratorIds: readonly number[]): Promise<void>;

  /** The roles and stores the administrator holds now, or `undefined` when it is no administrator of the business. */
  accessOf(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<MemberGrant | undefined>;

  /** The stores the actor reaches through its roles (D211). */
  reachOf(ctx: OperationContext, actor: Pick<TeamActor, 'administratorId' | 'scope'>): Promise<ActorReachView>;
}
