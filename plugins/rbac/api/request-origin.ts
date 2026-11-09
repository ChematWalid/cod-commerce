import type { ClientIpResolver } from '@cod/plugin-rate-limit';
import type { RequestContext } from '@vendure/core';
import { ACTIVITY_USER_AGENT_MAX_LENGTH } from '../domain/constants';

/** Where a request came from, as an activity row keeps it. */
export interface RequestOrigin {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

const NO_ORIGIN: RequestOrigin = { ip: null, userAgent: null };

/**
 * The client address and user agent of the request behind `ctx`. The address is what `resolver` makes of the
 * request: an IPv6 client is kept as its /64 network. A context with no request (a job) has no origin.
 */
export function requestOrigin(ctx: RequestContext, resolver: ClientIpResolver): RequestOrigin {
  const request = ctx.req;
  if (request === undefined) return NO_ORIGIN;
  const agent = request.headers['user-agent'];
  return {
    ip: resolver.resolve(request),
    userAgent: typeof agent === 'string' ? agent.slice(0, ACTIVITY_USER_AGENT_MAX_LENGTH) : null,
  };
}
