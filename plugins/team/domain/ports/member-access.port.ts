import type { TenantScope } from '@cod/shared';
import type { MemberGrant, MemberStoreGrant } from '../member-grant';
import type { ActorReachView } from '../member-reach';
import type { TeamActor } from '../team-actor';
import type { OperationContext } from './operation-context';

/**
 * Roles and store access of members, kept by rbac (D204). A refusal comes back as rbac's own `DomainError` (privilege
 * exceeded, role not found, store not accessible, ...): Team's API maps those codes beside its own.
 */
export interface MemberAccessPort {
  /**
   * Takes rbac's business lock in the transaction `ctx` carries, after Team's own (D213), so the access read next is
   * the access a later write replaces: no rbac `setMemberAccess` commits in between (D804).
   */
  holdAccess(ctx: OperationContext, scope: TenantScope): Promise<void>;

  /** Refuses a grant the actor could not make, before anyone holds it (D208). Writes nothing. */
  preview(ctx: OperationContext, actor: TeamActor, grant: MemberGrant): Promise<void>;

  /**
   * Refuses to act on a member holding `grant` when the actor could not change that holder (D60.4, D60.7). The grant is
   * judged by what remains of it: a role deleted since grants nothing, an archived store still counts. Writes nothing.
   */
  assertMayChangeHolder(ctx: OperationContext, actor: TeamActor, grant: MemberGrant): Promise<void>;

  /** Gives the administrator exactly `grant`, as `actor`, with rbac's escalation rules; an empty role list clears it. */
  setAccess(ctx: OperationContext, actor: TeamActor, administratorId: number, grant: MemberGrant): Promise<void>;

  /**
   * Withdraws every role of the administrator, as `actor`, naming `clearing`'s store access, and returns the grant it
   * held just before, read by rbac under its lock in the same transaction. A concurrent `setMemberAccess` is either in
   * that grant or refused after it (D804).
   */
  withdrawAccess(
    ctx: OperationContext,
    actor: TeamActor,
    administratorId: number,
    clearing: MemberStoreGrant,
  ): Promise<MemberGrant>;

  /** Signs the administrators out of stale sessions after their access changed; call after commit. */
  flush(administratorIds: readonly number[]): Promise<void>;

  /** The roles and stores the administrator holds now, or `undefined` when it is no administrator of the business. */
  accessOf(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<MemberGrant | undefined>;

  /** The stores the actor reaches through its roles (D211). */
  reachOf(ctx: OperationContext, actor: Pick<TeamActor, 'administratorId' | 'scope'>): Promise<ActorReachView>;
}
