import { describe, expect, it } from 'vitest';
import { hostOfSubdomain, normalizeHost, subdomainOfHost } from '../src/index';

describe('subdomainOfHost', () => {
  it('returns the single label before the platform domain', () => {
    expect(subdomainOfHost('demo.localhost', 'localhost')).toBe('demo');
  });

  it.each([
    ['a.b.localhost', 'localhost'],
    ['localhost', 'localhost'],
    ['demo.example.com', 'localhost'],
    ['notlocalhost', 'localhost'],
    ['.localhost', 'localhost'],
  ])('returns null for %s', (host, platformDomain) => {
    expect(subdomainOfHost(host, platformDomain)).toBeNull();
  });
});

describe('hostOfSubdomain', () => {
  it('joins the subdomain and the platform domain', () => {
    expect(hostOfSubdomain('demo', 'localhost')).toBe('demo.localhost');
  });
});

describe('normalizeHost', () => {
  it('is exported from the shared entry point', () => {
    expect(normalizeHost('DEMO.Localhost:3001')).toBe('demo.localhost');
  });
});
