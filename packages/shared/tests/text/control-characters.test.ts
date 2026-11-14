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

  it('finds a C1 control', () => {
    expect(hasControlCharacter('a\u0085b')).toBe(true);
    expect(hasControlCharacter('a\u009Bb', { allowLineBreaks: true })).toBe(true);
  });

  it('counts the Unicode line and paragraph separators as line breaks', () => {
    expect(hasControlCharacter('a\u2028b')).toBe(true);
    expect(hasControlCharacter('a\u2029b')).toBe(true);
    expect(hasControlCharacter('a\u2028b\u2029c', { allowLineBreaks: true })).toBe(false);
  });
});
