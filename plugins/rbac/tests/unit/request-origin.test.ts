import { ClientIpResolver } from '@cod/plugin-rate-limit';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { requestOrigin } from '../../api/request-origin';

const contextOf = (req: unknown): RequestContext => ({ req }) as unknown as RequestContext;

describe('requestOrigin', () => {
  it('reads the address through the resolver and the user agent from the headers', () => {
    // Arrange
    const ctx = contextOf({ ip: '203.0.113.9', headers: { 'user-agent': 'agent/1' } });

    // Act
    const origin = requestOrigin(ctx, new ClientIpResolver(''));

    // Assert
    expect(origin).toEqual({ ip: '203.0.113.9', userAgent: 'agent/1' });
  });

  it('keeps an IPv6 client as its /64 network', () => {
    // Arrange
    const ctx = contextOf({ ip: '2001:db8:1:2:aaaa:bbbb:cccc:dddd', headers: {} });

    // Act
    const origin = requestOrigin(ctx, new ClientIpResolver(''));

    // Assert
    expect(origin).toEqual({ ip: '2001:db8:1:2::/64', userAgent: null });
  });

  it('clips a long user agent to its column', () => {
    // Arrange
    const ctx = contextOf({ ip: '203.0.113.9', headers: { 'user-agent': 'u'.repeat(400) } });

    // Act
    const origin = requestOrigin(ctx, new ClientIpResolver(''));

    // Assert
    expect(origin.userAgent).toHaveLength(255);
  });

  it('has no origin for a context without a request', () => {
    // Arrange
    const ctx = contextOf(undefined);

    // Act
    const origin = requestOrigin(ctx, new ClientIpResolver(''));

    // Assert
    expect(origin).toEqual({ ip: null, userAgent: null });
  });
});
