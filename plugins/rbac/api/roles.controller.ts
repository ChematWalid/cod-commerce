import { tenantOf } from '@cod/plugin-tenancy';
import { Body, Controller, Get, Param, Post, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { CreateRoleService } from '../application/create-role.service';
import { DuplicateRoleService } from '../application/duplicate-role.service';
import { GetRolesService } from '../application/get-roles.service';
import { RoleNotFoundError } from '../domain/errors';
import { asOperationContext } from '../domain/ports/operation-context';
import type { BusinessRoleView } from '../domain/role-view';
import { RequestActors, roleActorOf } from './actor-of';
import { createCommandOf } from './dto';
import { RbacRestErrorFilter } from './error-mapping';
import { requirePermission } from './require-permission.decorator';
import { createRoleBody, duplicateLocale } from './rest-body';

/** Reading, adding and copying the roles of the caller's business for clients that do not speak GraphQL (ADR 0017); the same use cases and permissions. */
@Controller('roles')
@UseFilters(RbacRestErrorFilter)
export class RolesController {
  constructor(
    private readonly reader: GetRolesService,
    private readonly creator: CreateRoleService,
    private readonly duplicator: DuplicateRoleService,
    private readonly actors: RequestActors,
  ) {}

  @Get()
  @requirePermission('team.roles.view')
  list(@Ctx() ctx: RequestContext): Promise<readonly BusinessRoleView[]> {
    return this.reader.list(asOperationContext(ctx), tenantOf(ctx));
  }

  /** @throws RoleNotFoundError (404) when the id names none of this business */
  @Get(':id')
  @requirePermission('team.roles.view')
  async get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<BusinessRoleView> {
    const role = await this.reader.get(asOperationContext(ctx), tenantOf(ctx), id);
    if (role === undefined) throw new RoleNotFoundError();
    return role;
  }

  @Post()
  @requirePermission('team.roles.create')
  async create(@Ctx() ctx: RequestContext, @Body() body: unknown): Promise<BusinessRoleView> {
    const command = createCommandOf(createRoleBody(body));
    return this.creator.create(asOperationContext(ctx), await roleActorOf(this.actors, ctx), command);
  }

  @Post(':id/duplicate')
  @requirePermission('team.roles.create')
  async duplicate(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<BusinessRoleView> {
    const locale = duplicateLocale(body);
    return this.duplicator.duplicate(asOperationContext(ctx), await roleActorOf(this.actors, ctx), { id, locale });
  }
}
