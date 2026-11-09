import { tenantOf } from '@cod/plugin-tenancy';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import { CreateRoleService } from '../application/create-role.service';
import { DuplicateRoleService } from '../application/duplicate-role.service';
import { GetRolesService } from '../application/get-roles.service';
import { asOperationContext } from '../domain/ports/operation-context';
import type { BusinessRoleView } from '../domain/role-view';
import { RequestActors, roleActorOf } from './actor-of';
import { createCommandOf, type CreateBusinessRoleInputDto } from './dto';
import { withRbacErrors } from './error-mapping';
import { requirePermission } from './require-permission.decorator';

/** Reading and adding roles of the caller's business. No `@Transaction`: sessions flush after the use case commits (D55). */
@Resolver()
export class RolesResolver {
  constructor(
    private readonly creator: CreateRoleService,
    private readonly duplicator: DuplicateRoleService,
    private readonly reader: GetRolesService,
    private readonly actors: RequestActors,
  ) {}

  /** Every role of the business, built-ins first as stored. */
  @Query()
  @requirePermission('team.roles.view')
  businessRoles(@Ctx() ctx: RequestContext): Promise<readonly BusinessRoleView[]> {
    return withRbacErrors(() => this.reader.list(asOperationContext(ctx), tenantOf(ctx)));
  }

  /** The role, or `null` when the id names none of this business. */
  @Query()
  @requirePermission('team.roles.view')
  businessRole(@Ctx() ctx: RequestContext, @Args('id') id: string): Promise<BusinessRoleView | undefined> {
    return withRbacErrors(() => this.reader.get(asOperationContext(ctx), tenantOf(ctx), id));
  }

  /** Creates a custom role from the editor's choices (D63). */
  @Mutation()
  @requirePermission('team.roles.create')
  createBusinessRole(
    @Ctx() ctx: RequestContext,
    @Args('input') input: CreateBusinessRoleInputDto,
  ): Promise<BusinessRoleView> {
    return withRbacErrors(async () =>
      this.creator.create(asOperationContext(ctx), await roleActorOf(this.actors, ctx), createCommandOf(input)),
    );
  }

  /** Copies a role under a free name; `locale` (`en`, `ar`) picks the language of that name (D71). */
  @Mutation()
  @requirePermission('team.roles.create')
  duplicateBusinessRole(
    @Ctx() ctx: RequestContext,
    @Args('id') id: string,
    @Args('locale') locale: string | null | undefined,
  ): Promise<BusinessRoleView> {
    return withRbacErrors(async () =>
      this.duplicator.duplicate(asOperationContext(ctx), await roleActorOf(this.actors, ctx), {
        id,
        locale: locale ?? undefined,
      }),
    );
  }
}
