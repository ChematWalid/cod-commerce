import { tenantOf, TenantScoped } from '@cod/plugin-tenancy';
import { Controller, Get, UseFilters } from '@nestjs/common';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import {
  EffectivePermissionsService,
  type EffectivePermissionsView,
} from '../application/effective-permissions.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { RequestActors } from './actor-of';
import { PERMISSION_CATALOG_VIEW } from './catalog-view';
import { RbacRestErrorFilter } from './error-mapping';

/** What exists to grant and what the caller holds, for clients that do not speak GraphQL; any member may read both. */
@Controller('permissions')
@UseFilters(RbacRestErrorFilter)
export class PermissionsController {
  constructor(
    private readonly effective: EffectivePermissionsService,
    private readonly actors: RequestActors,
  ) {}

  /** The areas and permissions, with their labels. */
  @Get('catalog')
  @Allow(Permission.Authenticated)
  @TenantScoped()
  catalog(): typeof PERMISSION_CATALOG_VIEW {
    return PERMISSION_CATALOG_VIEW;
  }

  /** What the caller holds on the active store. */
  @Get()
  @Allow(Permission.Authenticated)
  @TenantScoped()
  async effectiveOfCaller(@Ctx() ctx: RequestContext): Promise<EffectivePermissionsView> {
    const { administratorId } = await this.actors.actorOf(ctx);
    return this.effective.of(asOperationContext(ctx), tenantOf(ctx), administratorId);
  }
}
