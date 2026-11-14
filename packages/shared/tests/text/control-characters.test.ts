import { describe, expect, it } from 'vitest';
import { hasControlCharacter } from '../../src/index';

describe('hasControlCharacter', () => {
  it('finds a NUL', () => {
    // Arrange
    const value = 'a\u0000b';

    // Act
    const found = hasControlCharacter(value);

    // Assert
    expect(found).toBe(true);
  });

  it('finds DEL', () => {
    expect(hasControlCharacter('a\u007Fb')).toBe(true);
  });

  it('allows tab and line breaks only when asked', () => {
    const value = 'line one\r\n\tline two';

    expect(hasControlCharacter(value)).toBe(true);
    expect(hasControlCharacter(value, { allowLineBreaks: true })).toBe(false);
    expect(hasControlCharacter('a\u0001b', { allowLineBreaks: true })).toBe(true);
  });

  it('passes Arabic and emoji text', () => {
    expect(hasControlCharacter('حذاء رياضي أحمر 👟')).toBe(false);
  });
});
