import { describe, expect, it } from 'vitest';
import { INTERNAL_BODY_LIMIT_BYTES } from '../../domain/constants';
import { internalOnlyPrefixes } from '../../domain/internal-prefixes';

describe('internalOnlyPrefixes', () => {
  it('lists the Shop API path, /store and /_internal', () => {
    expect(internalOnlyPrefixes('shop-api')).toEqual(['/shop-api', '/store', '/_internal']);
  });

  it('does not double a leading slash of the Shop API path', () => {
    expect(internalOnlyPrefixes('/shop-api')[0]).toBe('/shop-api');
  });

  it('never lists /stores, which stays public', () => {
    expect(internalOnlyPrefixes('shop-api')).not.toContain('/stores');
  });

  it('limits a body to 100 KB', () => {
    expect(INTERNAL_BODY_LIMIT_BYTES).toBe(102_400);
  });
});
