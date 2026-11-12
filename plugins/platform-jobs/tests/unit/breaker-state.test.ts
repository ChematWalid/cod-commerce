import { describe, expect, it } from 'vitest';
import { breakerStateAt } from '../../domain/breaker';
import { BREAKER_OPEN_MS } from '../../domain/constants';

const OPENED_AT = 1_700_000_000_000;

describe('breakerStateAt', () => {
  it('is closed without an opening time', () => {
    expect(breakerStateAt(undefined, OPENED_AT)).toBe('closed');
  });

  it('is open until 60 s after opening, then half-open', () => {
    expect(breakerStateAt(OPENED_AT, OPENED_AT)).toBe('open');
    expect(breakerStateAt(OPENED_AT, OPENED_AT + BREAKER_OPEN_MS - 1)).toBe('open');
    expect(breakerStateAt(OPENED_AT, OPENED_AT + BREAKER_OPEN_MS)).toBe('half-open');
  });
});
