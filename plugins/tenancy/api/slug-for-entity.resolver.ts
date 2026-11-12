import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, EntitySlugService, Permission, type RequestContext } from '@vendure/core';
import { platformStaffPermission } from './permissions';

/** Vendure's `SlugForEntityInput`, as its schema declares it. */
export interface SlugForEntityInputDto {
  readonly entityName: string;
  readonly fieldName: string;
  readonly inputValue: string;
  readonly entityId?: string;
}

/**
 * Replaces Vendure's own `slugForEntity`, which any signed-in administrator may call. It counts the value over the
 * whole table of any entity and column the caller names, whatever business owns the rows, so its answer told a
 * merchant whether another business held a value (D500). Only the superadmin and platform staff may call it; a
 * catalogue screen that needs a slug check gets its own business-scoped endpoint.
 */
@Resolver()
export class SlugForEntityResolver {
  constructor(private readonly entitySlugs: EntitySlugService) {}

  /** A unique slug for `input.inputValue` in `input.entityName.fieldName`, as Vendure computes it. */
  @Query()
  @Allow(Permission.SuperAdmin, platformStaffPermission.Permission)
  slugForEntity(@Ctx() ctx: RequestContext, @Args('input') input: SlugForEntityInputDto): Promise<string> {
    return this.entitySlugs.generateSlugFromInput(ctx, input);
  }
}
