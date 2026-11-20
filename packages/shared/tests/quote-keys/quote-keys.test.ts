import { describe, expect, it } from 'vitest';
import * as sharedIndex from '../../src/index';
import { InvalidQuoteKeysError, parseQuoteKeys, quoteKeyRing } from '../../src/quote-keys/index';

const FIRST_SECRET = 'a'.repeat(40);
const SECOND_SECRET = 'b'.repeat(40);

/** The message `act` throws, or '' when it does not throw. */
function messageOf(act: () => unknown): string {
  try {
    act();
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidQuoteKeysError);
    return (error as Error).message;
  }
  return '';
}

describe('parseQuoteKeys', () => {
  it('reads two kid:secret entries', () => {
    // Act
    const keys = parseQuoteKeys(`k1:${FIRST_SECRET}, k2:${SECOND_SECRET}`);

    // Assert
    expect(keys).toEqual([
      { kid: 'k1', secret: FIRST_SECRET },
      { kid: 'k2', secret: SECOND_SECRET },
    ]);
  });

  it.each([
    ['an empty list', ''],
    ['an entry without a colon', 'k1'],
    ['an empty kid', `:${FIRST_SECRET}`],
    ['a kid with upper case or underscore', `K_1:${FIRST_SECRET}`],
    ['a kid over 16 characters', `${'k'.repeat(17)}:${FIRST_SECRET}`],
    ['a trailing comma', `k1:${FIRST_SECRET},`],
  ])('refuses %s', (_name, value) => {
    // Act and Assert
    expect(() => parseQuoteKeys(value)).toThrow(InvalidQuoteKeysError);
  });

  it('refuses a secret shorter than 32 characters', () => {
    // Arrange
    const short = 'short-quote-secret-1234';

    // Act
    const message = messageOf(() => parseQuoteKeys(`k1:${short}`));

    // Assert
    expect(message).not.toBe('');
    expect(message).not.toContain(short);
  });

  it('refuses a duplicate kid', () => {
    // Act
    const message = messageOf(() => parseQuoteKeys(`k1:${FIRST_SECRET},k1:${SECOND_SECRET}`));

    // Assert
    expect(message).toContain('k1');
    expect(message).not.toContain(FIRST_SECRET);
    expect(message).not.toContain(SECOND_SECRET);
  });
});

describe('quoteKeyRing', () => {
  it('signs with the active kid and verifies with every kid of the ring', () => {
    // Arrange
    const keys = parseQuoteKeys(`k1:${FIRST_SECRET},k2:${SECOND_SECRET}`);

    // Act
    const ring = quoteKeyRing(keys, 'k2');

    // Assert
    expect(ring.activeKid).toBe('k2');
    expect(ring.kids).toEqual(['k1', 'k2']);
    expect(ring.keyOf('k1')).toBe(FIRST_SECRET);
    expect(ring.keyOf('k2')).toBe(SECOND_SECRET);
    expect(ring.keyOf('k9')).toBeUndefined();
  });

  it('refuses an active kid missing from the ring', () => {
    // Act
    const message = messageOf(() => quoteKeyRing(parseQuoteKeys(`k1:${FIRST_SECRET}`), 'k9'));

    // Assert
    expect(message).toContain('k9');
    expect(message).not.toContain(FIRST_SECRET);
  });

  it('never prints a secret in an error or in JSON', () => {
    // Arrange
    const ring = quoteKeyRing(parseQuoteKeys(`k1:${FIRST_SECRET},k2:${SECOND_SECRET}`), 'k1');
    const printable: { toString(): string } = ring;
    const inspect = (ring as unknown as Record<symbol, () => string>)[Symbol.for('nodejs.util.inspect.custom')];

    // Act
    const printed = [
      JSON.stringify(ring),
      JSON.stringify({ ring }),
      String(printable),
      printable.toString(),
      inspect?.call(ring) ?? '',
      messageOf(() => parseQuoteKeys(`k1:${FIRST_SECRET.slice(0, 20)}`)),
    ];

    // Assert
    for (const text of printed) {
      expect(text).not.toContain(FIRST_SECRET.slice(0, 20));
      expect(text).not.toContain(SECOND_SECRET.slice(0, 20));
    }
    expect(inspect).toBeTypeOf('function');
  });
});

describe('the @cod/shared index', () => {
  it('does not export the quote key ring from the @cod/shared index', () => {
    // Arrange
    const exported = Object.keys(sharedIndex);

    // Act and Assert
    expect(exported).not.toContain('parseQuoteKeys');
    expect(exported).not.toContain('quoteKeyRing');
    expect(exported).not.toContain('InvalidQuoteKeysError');
  });
});
