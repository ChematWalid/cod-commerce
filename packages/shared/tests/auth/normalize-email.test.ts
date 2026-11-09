import { describe, expect, it } from 'vitest';
import { normalizeEmail } from '../../src/index';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail(' A@B.test ')).toBe('a@b.test');
  });
});
