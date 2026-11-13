import {
  type AcceptInvitationCommand,
  ACTIVITY_ACTIONS,
  type BusinessId,
  DomainError,
  FEATURE_KEYS,
  requireFeature,
  type TenantScope,
} from '@cod/shared';
import { AccountElsewhereError, InvitationExpiredError, InvitationInvalidError } from '../domain/errors';
import { type Invitation, invitationStateOf } from '../domain/invitation';
import type { InvitationLocation } from '../domain/ports/invitation-lookup.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMember } from '../domain/team-member';
import type { TeamInvitationPorts } from './invitation-ports';
import { recordMemberActivity } from './invitation-guards';

/** Where the accept request came from, as its activity row keeps it. */
export type AcceptOrigin = Pick<TeamActor, 'ip' | 'userAgent'>;

const NO_ORIGIN: AcceptOrigin = { ip: null, userAgent: null };

/** Refusals the invitee may learn as they are; every other refusal becomes the one opaque code (D213). */
const TOLD_AS_IS = [AccountElsewhereError, InvitationExpiredError, InvitationInvalidError];

/** rbac refused the grant: the invitation can no longer be honoured as it was made (inviter gone, role deleted). */
class GrantRefused extends Error {
  constructor(readonly refusal: unknown) {
    super('The invitation grant was refused');
    this.name = 'GrantRefused';
  }
}

/** One accept, as it runs in the invitation's business. */
interface AcceptRun {
  readonly scope: TenantScope;
  readonly location: InvitationLocation;
  readonly tokenHash: string;
  readonly command: AcceptInvitationCommand;
  readonly origin: AcceptOrigin;
}

/** Turns an open invitation into an account and an active member (brief step 2), in D213's order. */
export class AcceptInvitationService {
  constructor(private readonly ports: TeamInvitationPorts) {}

  /**
   * In one transaction: claims the token, checks the address is free, creates the account, marks it verified, grants
   * the invitation's roles and stores as the inviter, and activates the member. Sessions are flushed after commit.
   *
   * @throws {InvitationInvalidError} for a token that opens nothing, or any refusal of the grant (the invitation is
   *   then revoked and its member removed) or of the account; the token stays open otherwise.
   * @throws {InvitationExpiredError} for the invitation of this token once its lifetime is over.
   * @throws {AccountElsewhereError} when the address already has an account (D201).
   */
  async accept(
    ctx: OperationContext,
    command: AcceptInvitationCommand,
    origin: AcceptOrigin = NO_ORIGIN,
  ): Promise<{ businessId: BusinessId }> {
    const tokenHash = this.ports.tokens.hash(command.token);
    const location = await this.ports.lookup.locate(ctx, tokenHash);
    if (location === undefined) throw new InvitationInvalidError();
    const scope: TenantScope = { businessId: location.businessId };
    await requireFeature(FEATURE_KEYS.TeamSeats, scope);
    const administratorId = await this.acceptOrRefuse(ctx, { scope, location, tokenHash, command, origin });
    // rbac flushed inside this transaction; a session read before the commit could still hold stale rights.
    await this.ports.access.flush([administratorId]);
    return { businessId: scope.businessId };
  }

  private async acceptOrRefuse(ctx: OperationContext, run: AcceptRun): Promise<number> {
    try {
      return await this.ports.transaction.run(ctx, run.scope, (transactional) => this.acceptIn(transactional, run));
    } catch (error: unknown) {
      if (error instanceof GrantRefused) {
        await this.revokeUnusable(ctx, run);
        throw opaqueRefusal(error.refusal);
      }
      throw opaqueRefusal(error);
    }
  }

  private async acceptIn(ctx: OperationContext, run: AcceptRun): Promise<number> {
    const { lock, invitations, accounts, clock } = this.ports;
    const { scope, command } = run;
    await lock.acquire(ctx, scope);
    const now = clock.now();
    if (!(await invitations.claim(ctx, scope, run.tokenHash, now))) throw await this.refusalOf(ctx, run, now);
    const { invitation, member } = await this.invitedOf(ctx, run);
    await accounts.assertEmailFree(ctx, member.email);
    const administratorId = await accounts.create(ctx, scope, {
      email: member.email,
      firstName: command.firstName,
      lastName: command.lastName,
      password: command.password,
    });
    await accounts.markVerified(ctx, administratorId, invitation.locale);
    await this.grant(ctx, run, invitation, administratorId);
    await this.join(ctx, run, { member, administratorId, now });
    return administratorId;
  }

  /** The claimed invitation and its member, which must still be invited. */
  private async invitedOf(
    ctx: OperationContext,
    { scope, location }: AcceptRun,
  ): Promise<{ invitation: Invitation; member: TeamMember }> {
    const invitation = await this.ports.invitations.findById(ctx, scope, location.invitationId);
    const member = invitation && (await this.ports.members.findById(ctx, scope, invitation.memberId));
    if (invitation === undefined || member?.status !== 'invited' || member.removedAt !== null) {
      throw new InvitationInvalidError();
    }
    return { invitation, member };
  }

  /** Grants as the inviter, so privilege is checked when it takes effect (D208). */
  private async grant(
    ctx: OperationContext,
    { scope, origin }: AcceptRun,
    invitation: Invitation,
    administratorId: number,
  ): Promise<void> {
    const inviter: TeamActor = { administratorId: invitation.invitedByAdministratorId, scope, ...origin };
    try {
      await this.ports.access.setAccess(ctx, inviter, administratorId, invitation.grant);
    } catch (error: unknown) {
      throw error instanceof DomainError ? new GrantRefused(error) : error;
    }
  }

  private async join(
    ctx: OperationContext,
    { scope, command, origin }: AcceptRun,
    { member, administratorId, now }: { member: TeamMember; administratorId: number; now: Date },
  ): Promise<void> {
    const { firstName, lastName } = command;
    const patch = { administratorId, firstName, lastName, status: 'active' as const, joinedAt: now, updatedAt: now };
    await this.ports.members.update(ctx, scope, member.id, patch);
    await recordMemberActivity(this.ports, ctx, {
      scope,
      actorAdministratorId: administratorId,
      origin,
      action: ACTIVITY_ACTIONS.INVITATION_ACCEPTED,
      summary: 'Invitation accepted',
      member: { id: member.id, firstName, lastName },
      changedFields: ['status'],
    });
  }

  /** The invitation of a matched hash that could not be claimed: expired says so, anything else is opaque. */
  private async refusalOf(ctx: OperationContext, { scope, location }: AcceptRun, now: Date): Promise<DomainError> {
    const invitation = await this.ports.invitations.findById(ctx, scope, location.invitationId);
    const expired = invitation !== undefined && invitationStateOf(invitation, now) === 'expired';
    return expired ? new InvitationExpiredError() : new InvitationInvalidError();
  }

  /**
   * In a transaction of its own, after the failed one rolled back (D213): revokes the invitation and removes its
   * still-invited member, as a revoke would, so no dead row stays on Pending holding the address. No one acted, so
   * the activity row has no actor.
   */
  private async revokeUnusable(ctx: OperationContext, { scope, location, origin }: AcceptRun): Promise<void> {
    const { lock, invitations, members, clock } = this.ports;
    await this.ports.transaction.run(ctx, scope, async (transactional) => {
      await lock.acquire(transactional, scope);
      const now = clock.now();
      const invitation = await invitations.findById(transactional, scope, location.invitationId);
      if (invitation === undefined) return;
      await invitations.update(transactional, scope, invitation.id, { revokedAt: now });
      const member = await members.findById(transactional, scope, invitation.memberId);
      if (member?.status !== 'invited' || member.removedAt !== null) return;
      await members.update(transactional, scope, member.id, { removedAt: now, updatedAt: now });
      await recordMemberActivity(this.ports, transactional, {
        scope,
        actorAdministratorId: null,
        origin,
        action: ACTIVITY_ACTIONS.INVITATION_REVOKED,
        summary: 'Invitation revoked',
        member,
      });
    });
  }
}

/** Keeps the refusals the invitee may learn, folds every other domain refusal into one code, lets faults through. */
function opaqueRefusal(error: unknown): unknown {
  if (TOLD_AS_IS.some((type) => error instanceof type)) return error;
  return error instanceof DomainError ? new InvitationInvalidError() : error;
}
