import { ClientIpResolver, type ClientRequest } from '@cod/plugin-rate-limit';
import { tenantOf } from '@cod/plugin-tenancy';
import { vendurePermissionName } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { AdministratorService, ForbiddenError, type Permission, type RequestContext } from '@vendure/core';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMemberViewOptions } from '../domain/team-member';

/** Longest user agent an activity row keeps. */
const USER_AGENT_MAX_LENGTH = 512;
const NO_RELATIONS: never[] = [];
// Custom permissions extend the enum at runtime only, so the compiler cannot know this name.
const SEE_SALARY = vendurePermissionName('team.members.edit') as unknown as Permission;

/** Where a request came from, as an activity row keeps it. */
export type RequestOrigin = Pick<TeamActor, 'ip' | 'userAgent'>;

/** The client address (an IPv6 client as its /64) and user agent of a request; none for a context without one. */
export function originOf(request: ClientRequest | undefined, ips: ClientIpResolver): RequestOrigin {
  if (request === undefined) return { ip: null, userAgent: null };
  const agent = request.headers['user-agent'];
  return {
    ip: ips.resolve(request),
    userAgent: typeof agent === 'string' ? agent.slice(0, USER_AGENT_MAX_LENGTH) : null,
  };
}

/** Identifies the administrator behind a request; what they may do comes from rbac, not from here (D60). */
@Injectable()
export class TeamRequestActors {
  constructor(
    private readonly administrators: AdministratorService,
    private readonly ips: ClientIpResolver,
  ) {}

  /** @throws ForbiddenError when no administrator stands behind the session. */
  async actorOf(ctx: RequestContext): Promise<TeamActor> {
    const scope = tenantOf(ctx);
    const userId = ctx.activeUserId;
    const administrator =
      userId === undefined ? undefined : await this.administrators.findOneByUserId(ctx, userId, NO_RELATIONS);
    if (administrator === undefined) throw new ForbiddenError();
    return {
      administratorId: administrator.id as number,
      scope: { businessId: scope.businessId },
      ...originOf(ctx.req, this.ips),
    };
  }

  /** The salary is shown to holders of `team.members.edit` on the active store only (D207). */
  viewOptionsOf(ctx: RequestContext): TeamMemberViewOptions {
    return { canSeeSalary: ctx.userHasPermissions([SEE_SALARY]) };
  }
}
