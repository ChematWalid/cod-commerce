import { tenantOf } from '@cod/plugin-tenancy';
import { ClientIpResolver } from '@cod/plugin-rate-limit';
import type { TenantContext } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { AdministratorService, ForbiddenError, type RequestContext } from '@vendure/core';
import type { RoleActor } from '../application/role-writer';
import { requestOrigin, type RequestOrigin } from './request-origin';

/** The caller of a tenant-scoped handler. */
export interface RequestActor {
  readonly administratorId: number;
  readonly tenant: TenantContext;
  readonly origin: RequestOrigin;
}

const NO_RELATIONS: never[] = [];

/** Identifies the administrator behind a request; what they may do comes from our rows, not from here (D60). */
@Injectable()
export class RequestActors {
  constructor(
    private readonly administrators: AdministratorService,
    private readonly ips: ClientIpResolver,
  ) {}

  /** @throws ForbiddenError when no administrator stands behind the session. */
  async actorOf(ctx: RequestContext): Promise<RequestActor> {
    const tenant = tenantOf(ctx);
    const userId = ctx.activeUserId;
    const administrator =
      userId === undefined ? undefined : await this.administrators.findOneByUserId(ctx, userId, NO_RELATIONS);
    if (administrator === undefined) throw new ForbiddenError();
    return { administratorId: administrator.id as number, tenant, origin: requestOrigin(ctx, this.ips) };
  }
}

/** The caller of a role write, in the shape the use cases take. */
export async function roleActorOf(actors: RequestActors, ctx: RequestContext): Promise<RoleActor> {
  const { administratorId, tenant, origin } = await actors.actorOf(ctx);
  return { administratorId, tenant, ...origin };
}
