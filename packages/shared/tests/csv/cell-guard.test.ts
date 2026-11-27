import { describe, expect, it } from 'vitest';
import { guardCell, unguardCell } from '../../src/csv/cell-guard';

describe('the formula guard of exported cells (D2209, Review Focus 2)', () => {
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '\r=1', '=HYPERLINK("x")'])(
    'prefixes cells starting with = + - @ tab or CR: %j',
    (value) => {
      // Act
      const guarded = guardCell(value);

      // Assert
      expect(guarded).toBe(`'${value}`);
    },
  );

  it('` =1+1` is escaped', () => {
    // Act
    const guarded = guardCell(' =1+1');

    // Assert
    expect(guarded).toBe("' =1+1");
  });

  it("'abc round-trips unchanged", () => {
    // Act
    const guarded = guardCell("'abc");

    // Assert
    expect(guarded).toBe("'abc");
    expect(unguardCell(guarded)).toBe("'abc");
  });

  it.each(['=HYPERLINK("x")', ' =1+1', "'=x", "''=x", '-', 'plain', "'", ''])(
    'reads back the original of %j',
    (value) => {
      // Act
      const back = unguardCell(guardCell(value));

      // Assert
      expect(back).toBe(value);
    },
  );

  it('numbers are never prefixed', () => {
    // Act
    const guarded = [guardCell(-5), guardCell(0), guardCell(null)];

    // Assert
    expect(guarded).toEqual([-5, 0, null]);
  });

  it('leaves text that starts with a letter, a digit or a quote before plain text', () => {
    // Act
    const guarded = ['Robe', '12 kg', "'abc", 'a=b'].map((value) => guardCell(value));

    // Assert
    expect(guarded).toEqual(['Robe', '12 kg', "'abc", 'a=b']);
  });
});
