import { toBusinessId } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import type { TenantScopeResolver } from '../application/ports/tenant-scope-resolver.port';
import { RequestTenantScope } from './request-tenant-scope';

/**
 * Stub — owner: P1.S1 (dated deviation 6, P0.S2b, 2026-11-08). Do not copy it as correct. Until the
 * `Business` entity exists, one channel stands for one business: the business id is the id of the channel
 * the `vendure-token` header selected, never a value from the request body. **The platform default channel is
 * treated as a business too** (a request without a token gets business `1`), which ADR 0002 forbids: the
 * default channel belongs to platform staff only. P1.S1's `TenantContextResolver` derives the business from
 * the authenticated administrator, rejects the default channel and checks the channel belongs to that business.
 */
export class ChannelTenantScopeResolver implements TenantScopeResolver<RequestContext> {
  /** The scope of the request's channel; see the class note for what P1.S1 changes. */
  resolve(ctx: RequestContext): RequestTenantScope {
    return new RequestTenantScope(ctx, toBusinessId(String(ctx.channelId)));
  }
}
