import { describe, expect, it } from 'vitest';
import { RESERVED_SUBDOMAINS, SUBDOMAIN_MAX_LENGTH, SUBDOMAIN_MIN_LENGTH, classifySubdomain } from '../src/index';

describe('classifySubdomain', () => {
  it('lowercases and trims, then reports available', () => {
    expect(classifySubdomain('  DEMO ')).toEqual({ subdomain: 'demo', status: 'available', reason: null });
  });

  it('accepts digits and inner hyphens at the length bounds', () => {
    expect(classifySubdomain('a-1').status).toBe('available');
    expect(classifySubdomain('a'.repeat(SUBDOMAIN_MAX_LENGTH)).status).toBe('available');
    expect(SUBDOMAIN_MIN_LENGTH).toBe(3);
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'a'.repeat(SUBDOMAIN_MAX_LENGTH + 1)],
    ['hyphen ends', '-a-'],
    ['underscore', 'a_b'],
    ['non-ASCII', 'أ'],
    ['empty', ''],
  ])('marks %s as invalid with a reason', (_label, raw) => {
    const result = classifySubdomain(raw);
    expect(result.status).toBe('invalid');
    expect(result.reason).not.toBeNull();
  });

  it('marks reserved names, case-insensitively', () => {
    const result = classifySubdomain('WWW');
    expect(result).toMatchObject({ subdomain: 'www', status: 'reserved' });
    expect(result.reason).not.toBeNull();
    expect(RESERVED_SUBDOMAINS).toContain('shop');
  });
});
