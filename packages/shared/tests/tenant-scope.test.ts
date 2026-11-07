import { describe, expect, it } from 'vitest';
import { InvalidBusinessIdError, MAX_BUSINESS_ID, toBusinessId } from '../src/index';

describe('toBusinessId', () => {
  it('accepts the largest 63-bit id', () => {
    expect(toBusinessId('9223372036854775807')).toBe('9223372036854775807');
    expect(MAX_BUSINESS_ID).toBe(2n ** 63n - 1n);
  });

  it('rejects an id above 2^63 − 1', () => {
    expect(() => toBusinessId('9223372036854775808')).toThrow(InvalidBusinessIdError);
  });

  it('rejects zero and leading zeros', () => {
    expect(() => toBusinessId('0')).toThrow(InvalidBusinessIdError);
    expect(() => toBusinessId('01')).toThrow(InvalidBusinessIdError);
  });

  it('rejects non-numeric input', () => {
    expect(() => toBusinessId('12a')).toThrow(InvalidBusinessIdError);
  });
});
