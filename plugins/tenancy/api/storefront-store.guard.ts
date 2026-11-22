import type { TenantContext } from '@cod/shared';
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import type { StorefrontContext, StorefrontContextsPort } from '../application/ports/storefront-contexts.port';
import { STOREFRONT_CONTEXTS } from '../application/tokens';
import type { StorefrontStoreContext } from '../domain/storefront-store';
import { StorefrontStoreRefusedError } from './storefront-store-refused.filter';
import { rememberStorefrontStore } from './storefront-store-of';
import { rememberTenant } from './tenant-of';

/** The storefront context of each request the guard let through. */
const contexts = new WeakMap<object, RequestContext>();

/**
 * The store id the internal signature covered. Only the internal-only middleware sets `req.internalAuth`, after
 * verifying the signature (D111); a client header such as `x-store-id` never reaches it unsigned.
 */
function signedStoreIdOf(req: unknown): string | undefined {
  if (typeof req !== 'object' || req === null) return undefined;
  const auth: unknown = (req as { internalAuth?: unknown }).internalAuth;
  if (typeof auth !== 'object' || auth === null) return undefined;
  const storeId: unknown = (auth as { storeId?: unknown }).storeId;
  return typeof storeId === 'string' ? storeId : undefined;
}

const tenantOfStore = (store: StorefrontStoreContext): TenantContext => ({
  businessId: store.businessId,
  storeIds: [store.storeId],
  activeStoreId: store.storeId,
});

/**
 * Lets a REST storefront call through only for the active store its internal signature names, and builds a shop
 * context on that store's channel with the store as tenant (D3201), so catalog and collections reads pass their
 * active-store check. Every refusal is a 404 with an empty body. Fails closed (ADR 0002).
 */
@Injectable()
export class StorefrontStoreGuard implements CanActivate {
  constructor(@Inject(STOREFRONT_CONTEXTS) private readonly storefronts: StorefrontContextsPort<RequestContext>) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    if (execution.getType() !== 'http') throw new StorefrontStoreRefusedError();
    const req = execution.switchToHttp().getRequest<object>();
    const storeId = signedStoreIdOf(req);
    const found = storeId === undefined ? undefined : await this.storefronts.forStore(storeId);
    if (found === undefined) throw new StorefrontStoreRefusedError();
    contexts.set(req, anchoredStorefrontContext(found));
    return true;
  }
}

/**
 * The context of `found` with its store as tenant and as storefront store, so `findTenant`, `storefrontStoreOf` and
 * the catalog's active-store check all read that one store. Internal to tenancy.
 */
export function anchoredStorefrontContext(found: StorefrontContext<RequestContext>): RequestContext {
  rememberTenant(found.ctx, tenantOfStore(found.store));
  rememberStorefrontStore(found.ctx, found.store);
  return found.ctx;
}

/**
 * The storefront context the guard built for `req`.
 *
 * @throws {@link StorefrontStoreRefusedError} when the guard did not let `req` through
 */
export function storefrontContextOf(req: object): RequestContext {
  const ctx = contexts.get(req);
  if (ctx === undefined) throw new StorefrontStoreRefusedError();
  return ctx;
}
