import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, UseFilters } from '@nestjs/common';
import { Ctx, type RequestContext } from '@vendure/core';
import { DeleteRoleService } from '../application/delete-role.service';
import { UpdateRoleService } from '../application/update-role.service';
import { asOperationContext } from '../domain/ports/operation-context';
import type { BusinessRoleView } from '../domain/role-view';
import { RequestActors, roleActorOf } from './actor-of';
import { updateCommandOf } from './dto';
import { RbacRestErrorFilter } from './error-mapping';
import { requirePermission } from './require-permission.decorator';
import { updateRoleBody } from './rest-body';

/** Editing and removing custom roles over REST; the same use cases and permissions as the GraphQL mutations. */
@Controller('roles')
@UseFilters(RbacRestErrorFilter)
export class RoleEditsController {
  constructor(
    private readonly updater: UpdateRoleService,
    private readonly deleter: DeleteRoleService,
    private readonly actors: RequestActors,
  ) {}

  /** Only what is sent changes; `description: null` clears it. */
  @Patch(':id')
  @requirePermission('team.roles.edit')
  async update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: unknown): Promise<BusinessRoleView> {
    const command = updateCommandOf(id, updateRoleBody(body));
    return this.updater.update(asOperationContext(ctx), await roleActorOf(this.actors, ctx), command);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @requirePermission('team.roles.delete')
  async remove(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<{ readonly success: true }> {
    await this.deleter.delete(asOperationContext(ctx), await roleActorOf(this.actors, ctx), id);
    return { success: true };
  }
}
