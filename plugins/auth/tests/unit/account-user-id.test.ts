import { describe, expect, it } from 'vitest';
import { accountUserId } from '../../domain/account-user-id';

describe('accountUserId', () => {
  it.each([
    [1, 1],
    ['42', 42],
    ['2147483647', 2_147_483_647],
  ])('accepts %s', (id, expected) => {
    // Act and Assert
    expect(accountUserId(id)).toBe(expected);
  });

  it.each([['2147483648'], [0], [-1], ['1.5'], ['abc'], ['9007199254740993']])('refuses %s', (id) => {
    // Act and Assert
    expect(() => accountUserId(id)).toThrow(RangeError);
  });
});
