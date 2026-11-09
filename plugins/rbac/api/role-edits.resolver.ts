import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { DeleteRoleService } from '../application/delete-role.service';
import { UpdateRoleService } from '../application/update-role.service';
import { asOperationContext } from '../domain/ports/operation-context';
import type { BusinessRoleView } from '../domain/role-view';
import { RequestActors, roleActorOf } from './actor-of';
import { choicesOf, type UpdateBusinessRoleInputDto } from './dto';
import { withRbacErrors } from './error-mapping';
import { requirePermission } from './require-permission.decorator';

/** Editing and removing custom roles. No `@Transaction`: sessions flush after the use case commits (D55). */
@Resolver()
export class RoleEditsResolver {
  constructor(
    private readonly updater: UpdateRoleService,
    private readonly deleter: DeleteRoleService,
    private readonly actors: RequestActors,
  ) {}

  /** Edits a custom role; only what is sent changes (D63). */
  @Mutation()
  @requirePermission('team.roles.edit')
  updateBusinessRole(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('input') input: UpdateBusinessRoleInputDto,
  ): Promise<BusinessRoleView> {
    return withRbacErrors(async () =>
      this.updater.update(asOperationContext(ctx), await roleActorOf(this.actors, ctx), {
        ...choicesOf(input),
        id,
        name: input.name ?? undefined,
        description: input.description,
        startFromRoleId: input.startFromRoleId ?? undefined,
      }),
    );
  }

  /** Deletes an unassigned custom role. */
  @Mutation()
  @requirePermission('team.roles.delete')
  deleteBusinessRole(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<{ readonly success: true }> {
    return withRbacErrors(async () => {
      await this.deleter.delete(asOperationContext(ctx), await roleActorOf(this.actors, ctx), id);
      return { success: true };
    });
  }
}
