import { type TenantContext, toBusinessId, toStoreId } from '@cod/shared';
import { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { rememberTenant, tenantOf } from '../../api/tenant-of';
import { TenantContextMissingError } from '../../api/tenant-context-missing.error';

const TENANT: TenantContext = {
  businessId: toBusinessId('11'),
  storeIds: [toStoreId('22')],
  activeStoreId: toStoreId('22'),
};

describe('tenantOf', () => {
  it('fails closed when the guard has not run', () => {
    expect(() => tenantOf(RequestContext.empty())).toThrow(TenantContextMissingError);
  });

  it('survives a copy of a context that has no request', () => {
    const ctx = RequestContext.empty();

    rememberTenant(ctx, TENANT);

    expect(tenantOf(ctx.copy())).toBe(TENANT);
  });

  it('survives a copy of a context that has a request', () => {
    const req = {};
    const ctx = Object.assign(RequestContext.empty(), { _req: req }) as unknown as RequestContext;

    rememberTenant(ctx, TENANT);

    expect(tenantOf(ctx.copy())).toBe(TENANT);
  });

  it('does not leak between contexts', () => {
    rememberTenant(RequestContext.empty(), TENANT);

    expect(() => tenantOf(RequestContext.empty())).toThrow(TenantContextMissingError);
  });
});
