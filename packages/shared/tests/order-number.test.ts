import { describe, expect, it } from 'vitest';
import { ORDER_NUMBER_DIGITS, formatOrderNumber } from '../src/index';

describe('formatOrderNumber', () => {
  it('pads to 8 digits', () => {
    expect(ORDER_NUMBER_DIGITS).toBe(8);
    expect(formatOrderNumber(1n)).toBe('#00000001');
  });

  it('keeps growing beyond 8 digits', () => {
    expect(formatOrderNumber(123456789n)).toBe('#123456789');
  });
});
