import { describe, expect, it } from 'vitest';
import { likeLiteralOf } from '../../infrastructure/like-literal';

describe('likeLiteralOf (Postgres LIKE with the default escape)', () => {
  it('escapes a backslash, a percent sign and an underscore', () => {
    // Act
    const literal = likeLiteralOf('A\\B%C_D');

    // Assert
    expect(literal).toBe('A\\\\B\\%C\\_D');
  });

  it('escapes a trailing backslash so the pattern never ends with the escape character', () => {
    // Act
    const literal = likeLiteralOf('SKU\\');

    // Assert
    expect(literal).toBe('SKU\\\\');
  });

  it('leaves a plain SKU as it is', () => {
    // Act
    const literal = likeLiteralOf('CAFÉ-1');

    // Assert
    expect(literal).toBe('CAFÉ-1');
  });
});
