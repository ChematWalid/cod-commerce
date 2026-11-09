import { tenantOf } from '@cod/plugin-tenancy';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { MemberAccessService, type MemberAccessView } from '../application/member-access.service';
import { parseVendureId } from '../domain/activity';
import type { MemberStoreAccess } from '../domain/constants';
import { MemberNotFoundError } from '../domain/errors';
import { asOperationContext } from '../domain/ports/operation-context';
import { RequestActors } from './actor-of';
import { withRbacErrors } from './error-mapping';
import { requirePermission } from './require-permission.decorator';

interface SetMemberAccessInputDto {
  readonly administratorId: string;
  readonly roleIds: readonly string[];
  readonly storeAccess: MemberStoreAccess;
  readonly storeIds?: readonly string[] | null;
}

/** Who holds which roles on which stores. No `@Transaction`: sessions flush after the use case commits (D55). */
@Resolver()
export class MemberAccessResolver {
  constructor(
    private readonly access: MemberAccessService,
    private readonly actors: RequestActors,
  ) {}

  /** Replaces a member's roles and store access. */
  @Mutation()
  @requirePermission('team.members.edit')
  setMemberAccess(
    @Ctx() ctx: RequestContext,
    @Args('input') input: SetMemberAccessInputDto,
  ): Promise<MemberAccessView> {
    return withRbacErrors(async () => {
      const administratorId = parseVendureId(input.administratorId);
      if (administratorId === undefined) throw new MemberNotFoundError();
      const { administratorId: actorId, tenant, origin } = await this.actors.actorOf(ctx);
      return this.access.setAccess(asOperationContext(ctx), {
        actor: { administratorId: actorId, scope: tenant, ...origin },
        administratorId,
        roleIds: input.roleIds,
        storeAccess: input.storeAccess,
        storeIds: input.storeIds ?? [],
      });
    });
  }

  /** A member's roles and store access, or `null` when the id names nobody in this business. */
  @Query()
  @requirePermission('team.members.view')
  memberAccess(
    @Ctx() ctx: RequestContext,
    @Args('administratorId') administratorId: string,
  ): Promise<MemberAccessView | undefined> {
    const parsed = parseVendureId(administratorId);
    if (parsed === undefined) return Promise.resolve(undefined);
    return withRbacErrors(() => this.access.getAccess(asOperationContext(ctx), tenantOf(ctx), parsed));
  }
}
