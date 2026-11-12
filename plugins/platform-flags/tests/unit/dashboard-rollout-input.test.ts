import { describe, expect, it } from 'vitest';
import { parseRolloutInput } from '../../dashboard/model/rollout-input';

describe('parseRolloutInput', () => {
  it.each([
    ['0', 0],
    ['30', 30],
    ['100', 100],
    [' 45 ', 45],
    ['٣٠', 30],
    ['۱۰۰', 100],
    ['٠', 0],
  ])('reads %j as the whole percent %d', (text, percent) => {
    expect(parseRolloutInput(text)).toBe(percent);
  });

  it.each(['', '  ', '-1', '101', '12.5', '1e1', 'abc', '30%', '١٠١', '۱٫۵'])('refuses %j', (text) => {
    expect(parseRolloutInput(text)).toBeNull();
  });
});
