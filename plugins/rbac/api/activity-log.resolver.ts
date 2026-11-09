import { asOperationContext } from '../domain/ports/operation-context';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Ctx, type RequestContext } from '@vendure/core';
import {
  GetActivityLogService,
  type ActivityLogRequest,
  type ActivityPage,
} from '../application/get-activity-log.service';
import { RequestActors } from './actor-of';
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
  viewer: Pick<ActivityLogRequest, 'visibleStoreIds' | 'viewerAdministratorId'>,
): ActivityLogRequest {
  return {
    first: orUndefined(input?.first),
    after: orUndefined(input?.after),
    actorAdministratorId: orUndefined(input?.actorAdministratorId),
    action: orUndefined(input?.action),
    entityType: orUndefined(input?.entityType),
    entityId: orUndefined(input?.entityId),
    ...viewer,
  };
}

/** The activity log of the caller's business. */
@Resolver()
export class ActivityLogResolver {
  constructor(
    private readonly activity: GetActivityLogService,
    private readonly actors: RequestActors,
  ) {}

  /** One page of the log, newest first. Rows of a store show only to members with access to that store; all-stores members also see archived stores (D65). */
  @Query()
  @requirePermission('settings.activity-log.view')
  async activityLog(
    @Ctx() ctx: RequestContext,
    @Args('input') input: ActivityLogInputDto | null | undefined,
  ): Promise<ActivityPage> {
    const { administratorId, tenant } = await this.actors.actorOf(ctx);
    const viewer = { visibleStoreIds: tenant.storeIds, viewerAdministratorId: administratorId };
    return withRbacErrors(() => this.activity.list(asOperationContext(ctx), tenant, toRequest(input, viewer)));
  }
}
