import { describe, expect, it } from 'vitest';
import { normalizeHost } from '../../src/tenancy/host';

describe('normalizeHost', () => {
  it('lowercases and strips the port', () => {
    // Arrange
    const raw = 'Demo.LocalHost:3001';
    // Act
    const host = normalizeHost(raw);
    // Assert
    expect(host).toBe('demo.localhost');
  });

  it('strips a trailing dot', () => {
    expect(normalizeHost('demo.localhost.')).toBe('demo.localhost');
  });

  it('keeps the brackets of an IPv6 host', () => {
    expect(normalizeHost('[::1]:3001')).toBe('[::1]');
  });

  it('returns null for a missing host', () => {
    expect(normalizeHost(null)).toBeNull();
  });

  it('returns null for an empty host', () => {
    expect(normalizeHost('')).toBeNull();
  });
});
