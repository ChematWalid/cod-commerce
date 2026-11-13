import {
  asOperationContext as asRbacContext,
  GrantPreviewService,
  MEMBER_SUSPENSION_CHECK,
  MemberAccessService,
  type MemberAccessView,
  type MemberSuspensionRegistry,
} from '@cod/plugin-rbac/member-access';
import { type TenantScope, toSnowflake } from '@cod/shared';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { TeamSuspensionCheck } from '../application/member-suspension';
import { MEMBER_REPOSITORY } from '../application/tokens';
import type { MemberGrant, MemberStoreGrant } from '../domain/member-grant';
import type { ActorReachView } from '../domain/member-reach';
import type { MemberAccessPort } from '../domain/ports/member-access.port';
import type { MemberRepositoryPort } from '../domain/ports/member-repository.port';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import { toRequestContext } from './request-scope';

const rbacContextOf = (ctx: OperationContext) => asRbacContext(toRequestContext(ctx));

/** rbac's view of a member's access as Team's grant. */
function grantOf(view: MemberAccessView): MemberGrant {
  return {
    roleIds: view.roles.map((role) => toSnowflake(role.id)),
    storeAccess: view.storeAccess,
    storeIds: view.storeIds.map(toSnowflake),
  };
}

/**
 * {@link MemberAccessPort} on rbac's member access, the one source of truth for roles and stores (D204). rbac's
 * refusals pass through as its own `DomainError`s. On bootstrap it registers Team's suspension check with rbac.
 */
@Injectable()
export class RbacMemberAccessAdapter implements MemberAccessPort, OnApplicationBootstrap {
  constructor(
    private readonly access: MemberAccessService,
    private readonly previews: GrantPreviewService,
    @Inject(MEMBER_SUSPENSION_CHECK) private readonly suspensions: MemberSuspensionRegistry,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepositoryPort,
  ) {}

  onApplicationBootstrap(): void {
    const check = new TeamSuspensionCheck(this.members);
    this.suspensions.register({
      isSuspended: (ctx, scope, administratorId) => check.isSuspended(asOperationContext(ctx), scope, administratorId),
    });
  }

  preview(ctx: OperationContext, actor: TeamActor, grant: MemberGrant): Promise<void> {
    return this.previews.previewGrant(rbacContextOf(ctx), { actor, ...grant });
  }

  assertMayChangeHolder(ctx: OperationContext, actor: TeamActor, grant: MemberGrant): Promise<void> {
    return this.previews.assertMayChangeHolder(rbacContextOf(ctx), { actor, ...grant });
  }

  async setAccess(ctx: OperationContext, actor: TeamActor, administratorId: number, grant: MemberGrant): Promise<void> {
    await this.access.setAccess(rbacContextOf(ctx), { actor, administratorId, ...grant });
  }

  async withdrawAccess(
    ctx: OperationContext,
    actor: TeamActor,
    administratorId: number,
    clearing: MemberStoreGrant,
  ): Promise<MemberGrant> {
    return grantOf(await this.access.withdrawAccess(rbacContextOf(ctx), { actor, administratorId, ...clearing }));
  }

  holdAccess(ctx: OperationContext, scope: TenantScope): Promise<void> {
    return this.access.holdForMemberChange(rbacContextOf(ctx), scope);
  }

  flush(administratorIds: readonly number[]): Promise<void> {
    return this.access.flushSessionsOf(administratorIds);
  }

  async accessOf(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<MemberGrant | undefined> {
    const view = await this.access.getAccess(rbacContextOf(ctx), scope, administratorId);
    return view === undefined ? undefined : grantOf(view);
  }

  async reachOf(ctx: OperationContext, actor: Pick<TeamActor, 'administratorId' | 'scope'>): Promise<ActorReachView> {
    const reach = await this.previews.reachOf(rbacContextOf(ctx), actor);
    return { allStores: reach.allStores, storeIds: reach.storeIds.map(toSnowflake) };
  }
}
