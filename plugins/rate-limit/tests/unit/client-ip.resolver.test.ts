import { describe, expect, it } from 'vitest';
import { ClientIpResolver } from '../../api/client-ip.resolver';

const request = (ip: string | undefined, headers: Record<string, string | string[] | undefined> = {}) => ({
  ip,
  headers,
});

describe('ClientIpResolver', () => {
  it('uses req.ip when no header is configured, ignoring a header the client sent', () => {
    // Arrange
    const resolver = new ClientIpResolver('');

    // Act
    const ip = resolver.resolve(request('203.0.113.5', { 'cf-connecting-ip': '198.51.100.9' }));

    // Assert
    expect(ip).toBe('203.0.113.5');
  });

  it('uses the configured header when it holds a valid address', () => {
    // Arrange
    const resolver = new ClientIpResolver('CF-Connecting-IP');

    // Act
    const ip = resolver.resolve(request('172.16.0.1', { 'cf-connecting-ip': ' 198.51.100.9 ' }));

    // Assert
    expect(ip).toBe('198.51.100.9');
  });

  it('reads an IPv6 header value', () => {
    // Arrange
    const resolver = new ClientIpResolver('cf-connecting-ip');

    // Act
    const ip = resolver.resolve(request('172.16.0.1', { 'cf-connecting-ip': '2001:DB8::1' }));

    // Assert
    expect(ip).toBe('2001:db8::1');
  });

  it.each([
    ['not an address', 'not-an-ip'],
    ['a list', '198.51.100.9, 203.0.113.7'],
    ['empty', ''],
    ['repeated', ['198.51.100.9', '203.0.113.7']],
    ['missing', undefined],
  ])('falls back to req.ip when the header is %s', (_label, value) => {
    // Arrange
    const resolver = new ClientIpResolver('cf-connecting-ip');

    // Act
    const ip = resolver.resolve(request('172.16.0.1', { 'cf-connecting-ip': value }));

    // Assert
    expect(ip).toBe('172.16.0.1');
  });

  it('writes an IPv4-mapped address as plain IPv4 so both spellings share a bucket', () => {
    // Arrange
    const resolver = new ClientIpResolver('');

    // Act
    const ip = resolver.resolve(request('::ffff:203.0.113.5'));

    // Assert
    expect(ip).toBe('203.0.113.5');
  });

  it('answers a fixed placeholder when no address is known at all', () => {
    // Arrange
    const resolver = new ClientIpResolver('');

    // Act
    const ip = resolver.resolve(request(undefined));

    // Assert
    expect(ip).toBe('unknown');
  });
});
