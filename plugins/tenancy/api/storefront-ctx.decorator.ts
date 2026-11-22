import { applyDecorators, createParamDecorator, type ExecutionContext, UseFilters, UseGuards } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { StorefrontStoreRefusedFilter } from './storefront-store-refused.filter';
import { StorefrontStoreGuard, storefrontContextOf } from './storefront-store.guard';

/**
 * Requires a signed, active store on a REST handler or controller (D3201) and answers every refusal 404 with an empty
 * body. The consuming plugin must import `TenancyPlugin`.
 */
export const StorefrontScoped = (): MethodDecorator & ClassDecorator =>
  applyDecorators(UseGuards(StorefrontStoreGuard), UseFilters(StorefrontStoreRefusedFilter));

/**
 * The shop context on the signed store's channel, with that store as tenant: the context a storefront handler reads
 * with, instead of Vendure's `@Ctx()`, which stays on the default channel.
 */
export const StorefrontCtx = createParamDecorator((_data: unknown, execution: ExecutionContext): RequestContext =>
  storefrontContextOf(execution.switchToHttp().getRequest<object>()),
);
