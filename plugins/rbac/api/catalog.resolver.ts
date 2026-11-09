import { tenantOf, TenantScoped } from '@cod/plugin-tenancy';
import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import {
  EffectivePermissionsService,
  type EffectivePermissionsView,
} from '../application/effective-permissions.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { RequestActors } from './actor-of';
import { PERMISSION_CATALOG_VIEW } from './catalog-view';
import { withRbacErrors } from './error-mapping';

/** What exists to grant and what the caller holds; any member of the business can read both. */
@Resolver()
export class CatalogResolver {
  constructor(
    private readonly effective: EffectivePermissionsService,
    private readonly actors: RequestActors,
  ) {}

  /** The areas and permissions, with their labels. */
  @Query()
  @Allow(Permission.Authenticated)
  @TenantScoped()
  permissionCatalog(): typeof PERMISSION_CATALOG_VIEW {
    return PERMISSION_CATALOG_VIEW;
  }

  /** What the caller holds on the active store. */
  @Query()
  @Allow(Permission.Authenticated)
  @TenantScoped()
  effectivePermissions(@Ctx() ctx: RequestContext): Promise<EffectivePermissionsView> {
    return withRbacErrors(async () => {
      const { administratorId } = await this.actors.actorOf(ctx);
      return this.effective.of(asOperationContext(ctx), tenantOf(ctx), administratorId);
    });
  }
}
