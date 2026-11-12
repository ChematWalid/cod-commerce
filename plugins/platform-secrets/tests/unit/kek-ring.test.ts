import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { InvalidKekRingError, parseKekRing } from '../../infrastructure/kek-ring';

const HEX_ONE = '11'.repeat(32);
const HEX_TWO = 'ab'.repeat(32);

const failureOf = (keks: string, activeKid: string): InvalidKekRingError => {
  try {
    parseKekRing(keks, activeKid);
  } catch (error) {
    if (error instanceof InvalidKekRingError) return error;
    throw error;
  }
  throw new Error('accepted');
};

describe('parseKekRing', () => {
  it('reads one key and names it active', () => {
    // Act
    const ring = parseKekRing(`k1:${HEX_ONE}`, 'k1');

    // Assert
    expect(ring.activeKid).toBe('k1');
    expect(ring.key('k1').equals(Buffer.from(HEX_ONE, 'hex'))).toBe(true);
    expect(ring.key('k1').length).toBe(32);
  });

  it('reads several keys, tolerating spaces, and serves each by kid', () => {
    // Act
    const ring = parseKekRing(` k1:${HEX_ONE} , k2:${HEX_TWO} `, 'k2');

    // Assert
    expect(ring.activeKid).toBe('k2');
    expect(ring.key('k1').toString('hex')).toBe(HEX_ONE);
    expect(ring.key('k2').toString('hex')).toBe(HEX_TWO);
  });

  it('accepts upper-case hex', () => {
    // Act and Assert
    expect(parseKekRing(`k1:${HEX_TWO.toUpperCase()}`, 'k1').key('k1').toString('hex')).toBe(HEX_TWO);
  });

  it('refuses a key of 63 hex characters', () => {
    // Act and Assert
    expect(() => parseKekRing(`k1:${HEX_ONE.slice(1)}`, 'k1')).toThrow(InvalidKekRingError);
  });

  it('refuses a key of 65 hex characters and one with a non-hex character', () => {
    // Act and Assert
    expect(() => parseKekRing(`k1:${HEX_ONE}1`, 'k1')).toThrow(InvalidKekRingError);
    expect(() => parseKekRing(`k1:${'zz'.repeat(32)}`, 'k1')).toThrow(InvalidKekRingError);
  });

  it('refuses an active kid that names no key', () => {
    // Act
    const failure = failureOf(`k1:${HEX_ONE}`, 'k9');

    // Assert
    expect(failure.message).toContain('k9');
  });

  it.each([
    ['an empty list', ''],
    ['an entry without a colon', HEX_ONE],
    ['an empty kid', `:${HEX_ONE}`],
    ['a kid with a capital', `K1:${HEX_ONE}`],
    ['a kid of 17 characters', `${'a'.repeat(17)}:${HEX_ONE}`],
    ['a repeated kid', `k1:${HEX_ONE},k1:${HEX_TWO}`],
    ['a trailing comma', `k1:${HEX_ONE},`],
  ])('refuses %s', (_name, keks) => {
    // Act and Assert
    expect(() => parseKekRing(keks, 'k1')).toThrow(InvalidKekRingError);
  });

  it('names the kid that reads as a job continuation, and accepts k2', () => {
    // Act
    const failure = failureOf(`r2:${HEX_ONE}`, 'r2');
    const suffixed = failureOf(`k-r10:${HEX_ONE}`, 'k-r10');
    const ring = parseKekRing(`k2:${HEX_ONE}`, 'k2');

    // Assert
    expect(failure.message).toContain('r2');
    expect(suffixed.message).toContain('k-r10');
    expect(ring.activeKid).toBe('k2');
  });

  it('never echoes a key in its messages', () => {
    // Arrange
    const attempts = [`k1:${HEX_ONE.slice(1)}`, `k1:${HEX_ONE},k1:${HEX_TWO}`, `k1:${HEX_ONE}`, `bad:${HEX_TWO}zz`];

    // Act
    const messages = attempts.map((keks) => failureOf(keks, 'k9').message);

    // Assert
    for (const message of messages) {
      expect(message).not.toContain(HEX_ONE.slice(1));
      expect(message).not.toContain(HEX_TWO);
      expect(message).not.toContain('1111');
      expect(message).not.toContain('abab');
    }
  });

  it('refuses a kid the ring does not hold when asked for its key', () => {
    // Arrange
    const ring = parseKekRing(`k1:${HEX_ONE}`, 'k1');

    // Act and Assert
    expect(() => ring.key('k2')).toThrow(InvalidKekRingError);
  });

  it('hands out copies, so a caller cannot change the ring', () => {
    // Arrange
    const ring = parseKekRing(`k1:${HEX_ONE}`, 'k1');

    // Act
    ring.key('k1').fill(0);

    // Assert
    expect(ring.key('k1').toString('hex')).toBe(HEX_ONE);
  });

  it('hides its keys when serialised', () => {
    // Arrange
    const ring = parseKekRing(`k1:${HEX_ONE}`, 'k1');

    // Act
    const shown = `${JSON.stringify(ring)}${inspect(ring)}`;

    // Assert
    expect(shown).not.toContain('1111');
  });
});
