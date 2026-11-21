import { ClientIpResolver } from '@cod/plugin-rate-limit';
import { Injectable } from '@nestjs/common';
import { AdministratorService, ForbiddenError, type RequestContext } from '@vendure/core';
import type { ActivityActor } from '../application/ports/product-activity.port';

/** Longest user agent an activity row keeps. */
const USER_AGENT_MAX_LENGTH = 512;
const NO_RELATIONS: never[] = [];

/** Identifies the administrator behind a request and where it came from, as activity rows keep them. */
@Injectable()
export class ImportRequestActors {
  constructor(
    private readonly administrators: AdministratorService,
    private readonly ips: ClientIpResolver,
  ) {}

  /** @throws ForbiddenError when no administrator stands behind the session. */
  async actorOf(ctx: RequestContext): Promise<ActivityActor> {
    const userId = ctx.activeUserId;
    const administrator =
      userId === undefined ? undefined : await this.administrators.findOneByUserId(ctx, userId, NO_RELATIONS);
    if (administrator === undefined) throw new ForbiddenError();
    const request = ctx.req;
    const agent = request?.headers['user-agent'];
    return {
      administratorId: administrator.id as number,
      ip: request === undefined ? null : this.ips.resolve(request),
      userAgent: typeof agent === 'string' ? agent.slice(0, USER_AGENT_MAX_LENGTH) : null,
    };
  }
}
