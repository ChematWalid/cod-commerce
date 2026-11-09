import { tenantOf, TenantScoped } from '@cod/plugin-tenancy';
import { type LocalizedLabel, PERMISSION_AREAS, PERMISSION_CATALOG } from '@cod/shared';
import { Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, type RequestContext } from '@vendure/core';
import {
  EffectivePermissionsService,
  type EffectivePermissionsView,
} from '../application/effective-permissions.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { RequestActors } from './actor-of';
import { withRbacErrors } from './error-mapping';

/** French labels are deferred and fall back to English (D72), so clients always get a text. */
const withFallback = (label: LocalizedLabel): Required<LocalizedLabel> => ({ ...label, fr: label.fr ?? label.en });

const CATALOG = {
  areas: PERMISSION_AREAS.map((area) => ({ ...area, label: withFallback(area.label) })),
  permissions: PERMISSION_CATALOG.map((entry) => ({ ...entry, label: withFallback(entry.label) })),
};

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
  permissionCatalog(): typeof CATALOG {
    return CATALOG;
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
