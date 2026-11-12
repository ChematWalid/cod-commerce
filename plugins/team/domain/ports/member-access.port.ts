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

  /** Gives the administrator exactly `grant`, as `actor`, with rbac's escalation rules; an empty role list clears it. */
  setAccess(ctx: OperationContext, actor: TeamActor, administratorId: number, grant: MemberGrant): Promise<void>;

  /** Signs the administrators out of stale sessions after their access changed; call after commit. */
  flush(administratorIds: readonly number[]): Promise<void>;

  /** The stores the actor reaches through its roles (D211). */
  reachOf(ctx: OperationContext, actor: Pick<TeamActor, 'administratorId' | 'scope'>): Promise<ActorReachView>;
}
