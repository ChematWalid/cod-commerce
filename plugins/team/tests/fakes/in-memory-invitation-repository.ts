import type { Snowflake, TenantScope } from '@cod/shared';
import { type Invitation, invitationStateOf, type IssuedInvitation } from '../../domain/invitation';
import type { InvitationLocation, InvitationLookupPort } from '../../domain/ports/invitation-lookup.port';
import type { InvitationPatch, InvitationRepositoryPort } from '../../domain/ports/invitation-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';

/** Strips the hash, as the table's `select: false` column does on every generic read. */
const withoutHash = (row: IssuedInvitation): Invitation =>
  Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'tokenHash')) as unknown as Invitation;

/** Oldest first, by creation then id, as the table orders them. */
const byCreation = (left: Invitation, right: Invitation): number =>
  left.createdAt.getTime() - right.createdAt.getTime() || (BigInt(left.id) < BigInt(right.id) ? -1 : 1);

/** Invitations in memory, hash included, with the unscoped token lookup of D208 on the same rows. */
export class InMemoryInvitationRepository implements InvitationRepositoryPort, InvitationLookupPort {
  rows: IssuedInvitation[] = [];

  insert(_ctx: OperationContext, scope: TenantScope, invitation: IssuedInvitation): Promise<void> {
    if (this.rows.some((row) => row.tokenHash === invitation.tokenHash)) {
      return Promise.reject(new Error('duplicate token hash'));
    }
    this.rows.push({ ...invitation, businessId: scope.businessId });
    return Promise.resolve();
  }

  findById(_ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<Invitation | undefined> {
    const row = this.rows.find((candidate) => candidate.businessId === scope.businessId && candidate.id === id);
    return Promise.resolve(row === undefined ? undefined : withoutHash(row));
  }

  latestOfMember(_ctx: OperationContext, scope: TenantScope, memberId: Snowflake): Promise<Invitation | undefined> {
    const ofMember = this.rows.filter((row) => row.businessId === scope.businessId && row.memberId === memberId);
    const latest = ofMember.toSorted(byCreation).at(-1);
    return Promise.resolve(latest === undefined ? undefined : withoutHash(latest));
  }

  async latestOfMembers(
    ctx: OperationContext,
    scope: TenantScope,
    memberIds: readonly Snowflake[],
  ): Promise<ReadonlyMap<Snowflake, Invitation>> {
    const found = new Map<Snowflake, Invitation>();
    for (const memberId of memberIds) {
      const latest = await this.latestOfMember(ctx, scope, memberId);
      if (latest !== undefined) found.set(memberId, latest);
    }
    return found;
  }

  claim(_ctx: OperationContext, scope: TenantScope, tokenHash: string, now: Date): Promise<boolean> {
    const index = this.rows.findIndex(
      (row) =>
        row.businessId === scope.businessId && row.tokenHash === tokenHash && invitationStateOf(row, now) === 'open',
    );
    const row = this.rows[index];
    if (row === undefined) return Promise.resolve(false);
    this.rows[index] = { ...row, acceptedAt: now };
    return Promise.resolve(true);
  }

  countOpen(_ctx: OperationContext, scope: TenantScope, now: Date): Promise<number> {
    return Promise.resolve(
      this.rows.filter((row) => row.businessId === scope.businessId && invitationStateOf(row, now) === 'open').length,
    );
  }

  update(_ctx: OperationContext, scope: TenantScope, id: Snowflake, patch: InvitationPatch): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.businessId === scope.businessId && row.id === id);
    const row = this.rows[index];
    if (row === undefined) return Promise.resolve(false);
    this.rows[index] = { ...row, ...patch };
    return Promise.resolve(true);
  }

  locate(_ctx: OperationContext, tokenHash: string): Promise<InvitationLocation | undefined> {
    const row = this.rows.find((candidate) => candidate.tokenHash === tokenHash);
    return Promise.resolve(row === undefined ? undefined : { businessId: row.businessId, invitationId: row.id });
  }
}
