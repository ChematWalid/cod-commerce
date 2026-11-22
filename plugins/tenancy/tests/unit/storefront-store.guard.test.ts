import type { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { StorefrontStoreGuard, storefrontContextOf } from '../../api/storefront-store.guard';
import { StorefrontStoreRefusedError, StorefrontStoreRefusedFilter } from '../../api/storefront-store-refused.filter';
import { storefrontStoreOf } from '../../api/storefront-store-of';
import { findTenant } from '../../api/tenant-of';
import type { StorefrontContext, StorefrontContextsPort } from '../../application/ports/storefront-contexts.port';
import type { StorefrontStoreContext } from '../../domain/storefront-store';

const STORE_A: StorefrontStoreContext = {
  storeId: toStoreId(toSnowflake('7340032000000001')),
  businessId: toBusinessId('41'),
  channelId: 3,
  soldOutBehavior: 'hide',
  language: 'ar',
};

/** Knows store A only; store B is disabled (archived, or of a suspended business), so it is not found. */
class FakeContexts implements StorefrontContextsPort<RequestContext> {
  readonly asked: string[] = [];

  forStore(rawStoreId: string): Promise<StorefrontContext<RequestContext> | undefined> {
    this.asked.push(rawStoreId);
    if (rawStoreId !== STORE_A.storeId) return Promise.resolve(undefined);
    const ctx = { channelId: STORE_A.channelId } as unknown as RequestContext;
    return Promise.resolve({ ctx, store: STORE_A });
  }
}

const httpExecution = (req: object): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
  }) as unknown as ExecutionContext;

function setUp(): { guard: StorefrontStoreGuard; contexts: FakeContexts } {
  const contexts = new FakeContexts();
  return { guard: new StorefrontStoreGuard(contexts), contexts };
}

describe('StorefrontStoreGuard', () => {
  it('refuses a request the internal signature did not cover, without looking a store up', async () => {
    // Arrange
    const { guard, contexts } = setUp();

    // Act
    const verdict = guard.canActivate(httpExecution({ headers: {} }));

    // Assert
    await expect(verdict).rejects.toBeInstanceOf(StorefrontStoreRefusedError);
    expect(contexts.asked).toEqual([]);
  });

  it('refuses a client x-store-id header that no signature covered', async () => {
    // Arrange
    const { guard, contexts } = setUp();

    // Act
    const verdict = guard.canActivate(httpExecution({ headers: { 'x-store-id': STORE_A.storeId } }));

    // Assert
    await expect(verdict).rejects.toBeInstanceOf(StorefrontStoreRefusedError);
    expect(contexts.asked).toEqual([]);
  });

  it('refuses a signed request without a store', async () => {
    // Arrange
    const { guard } = setUp();

    // Act and Assert
    await expect(guard.canActivate(httpExecution({ internalAuth: { kid: 'k1' } }))).rejects.toBeInstanceOf(
      StorefrontStoreRefusedError,
    );
  });

  it('refuses a signed store that is disabled or unknown', async () => {
    // Arrange
    const { guard } = setUp();
    const req = { internalAuth: { kid: 'k1', storeId: '7340032000000002' } };

    // Act and Assert
    await expect(guard.canActivate(httpExecution(req))).rejects.toBeInstanceOf(StorefrontStoreRefusedError);
    expect(() => storefrontContextOf(req)).toThrow(StorefrontStoreRefusedError);
  });

  it('refuses a GraphQL call: the storefront context is a REST surface', async () => {
    // Arrange
    const { guard } = setUp();
    const execution = { getType: () => 'graphql' } as unknown as ExecutionContext;

    // Act and Assert
    await expect(guard.canActivate(execution)).rejects.toBeInstanceOf(StorefrontStoreRefusedError);
  });

  it('runs a signed request on its store channel, with that store as the tenant', async () => {
    // Arrange
    const { guard } = setUp();
    const req = { internalAuth: { kid: 'k1', storeId: STORE_A.storeId } };

    // Act
    const allowed = await guard.canActivate(httpExecution(req));

    // Assert
    expect(allowed).toBe(true);
    const ctx = storefrontContextOf(req);
    expect(ctx.channelId).toBe(STORE_A.channelId);
    expect(findTenant(ctx)).toEqual({
      businessId: STORE_A.businessId,
      storeIds: [STORE_A.storeId],
      activeStoreId: STORE_A.storeId,
    });
    expect(storefrontStoreOf(ctx)).toEqual(STORE_A);
  });
});

describe('StorefrontStoreRefusedFilter', () => {
  it('answers 404 with an empty body, so a caller learns nothing about the store', () => {
    // Arrange
    const sent: { status?: number; ended: boolean; body?: unknown } = { ended: false };
    const res = {
      status(code: number) {
        sent.status = code;
        return res;
      },
      end(body?: unknown) {
        sent.ended = true;
        sent.body = body;
        return res;
      },
    };
    const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;

    // Act
    new StorefrontStoreRefusedFilter().catch(new StorefrontStoreRefusedError(), host);

    // Assert
    expect(sent).toEqual({ status: 404, ended: true, body: undefined });
  });
});

describe('storefrontStoreOf', () => {
  it('refuses a context the storefront guard did not build', () => {
    // Act and Assert
    expect(() => storefrontStoreOf({} as unknown as RequestContext)).toThrow(StorefrontStoreRefusedError);
  });
});
