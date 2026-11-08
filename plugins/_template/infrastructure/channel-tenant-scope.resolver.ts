import { toBusinessId } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import type { TenantScopeResolver } from '../application/ports/tenant-scope-resolver.port';
import { RequestTenantScope } from './request-tenant-scope';

/**
 * Stub — owner: P1.S1 (dated deviation 6, P0.S2b, 2026-11-08). Until the `Business` entity exists, one
 * channel stands for one business: the business id is the id of the channel the `vendure-token` header
 * selected, never a value from the request body. P1.S1's `TenantContextResolver` derives it from the
 * authenticated administrator and checks the channel belongs to that business (ADR 0002).
 */
export class ChannelTenantScopeResolver implements TenantScopeResolver<RequestContext> {
  resolve(ctx: RequestContext): RequestTenantScope {
    return new RequestTenantScope(ctx, toBusinessId(String(ctx.channelId)));
  }
}
