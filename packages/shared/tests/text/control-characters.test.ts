import { describe, expect, it } from 'vitest';
import { hasBidiControl, hasControlCharacter } from '../../src/index';

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

  it('keeps Arabic text with bidi marks and isolates', () => {
    // Arrange: RLM, LRM, an RLE...PDF embedding and an RLI...PDI isolate around a Latin SKU
    const value = '\u200Fحذاء \u2067SKU-1\u2069 \u202Bمقاس\u202C\u200E';

    // Act + Assert
    expect(hasControlCharacter(value)).toBe(false);
    expect(hasControlCharacter(value, { allowLineBreaks: true })).toBe(false);
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

describe('hasBidiControl', () => {
  it.each([
    ['RLO', '\u202E'],
    ['LRE', '\u202A'],
    ['PDF', '\u202C'],
    ['LRI', '\u2066'],
    ['PDI', '\u2069'],
  ])('finds the embedding, override or isolate control %s', (_name, control) => {
    // Act
    const found = hasBidiControl(`Invoice${control}fdp.exe`);

    // Assert
    expect(found).toBe(true);
  });

  it('keeps the direction marks RLM, LRM and ALM that Arabic text needs', () => {
    // Act
    const found = hasBidiControl('\u200Fحذاء\u061C SKU-1\u200E');

    // Assert
    expect(found).toBe(false);
  });
});
