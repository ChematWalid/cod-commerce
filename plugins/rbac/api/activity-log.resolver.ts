import { asOperationContext } from '../domain/ports/operation-context';
import { tenantOf } from '@cod/plugin-tenancy';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import {
  GetActivityLogService,
  type ActivityLogRequest,
  type ActivityPage,
} from '../application/get-activity-log.service';
import { withRbacErrors } from './error-mapping';
import { requirePermission } from './require-permission.decorator';

interface ActivityLogInputDto {
  readonly first?: number | null;
  readonly after?: string | null;
  readonly actorAdministratorId?: string | null;
  readonly action?: string | null;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
}

const orUndefined = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

function toRequest(
  input: ActivityLogInputDto | null | undefined,
  visibleStoreIds: ActivityLogRequest['visibleStoreIds'],
): ActivityLogRequest {
  return {
    first: orUndefined(input?.first),
    after: orUndefined(input?.after),
    actorAdministratorId: orUndefined(input?.actorAdministratorId),
    action: orUndefined(input?.action),
    entityType: orUndefined(input?.entityType),
    entityId: orUndefined(input?.entityId),
    visibleStoreIds,
  };
}

/** The activity log of the caller's business. */
@Resolver()
export class ActivityLogResolver {
  constructor(private readonly activity: GetActivityLogService) {}

  /** One page of the log, newest first. Rows of a store show only to members with access to that store (D65). */
  @Query()
  @requirePermission('settings.activity-log.view')
  activityLog(
    @Ctx() ctx: RequestContext,
    @Args('input') input: ActivityLogInputDto | null | undefined,
  ): Promise<ActivityPage> {
    const tenant = tenantOf(ctx);
    return withRbacErrors(() => this.activity.list(asOperationContext(ctx), tenant, toRequest(input, tenant.storeIds)));
  }
}
