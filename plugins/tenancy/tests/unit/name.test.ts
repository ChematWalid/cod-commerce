import { describe, expect, it } from 'vitest';
import { NAME_MAX_LENGTH } from '../../domain/constants';
import { NameInvalidError } from '../../domain/errors';
import { assertValidName } from '../../domain/name';

describe('assertValidName', () => {
  it('accepts a name at the length limit', () => {
    // Act & Assert
    expect(() => {
      assertValidName('x'.repeat(NAME_MAX_LENGTH));
    }).not.toThrow();
  });

  it.each(['', '   ', 'x'.repeat(NAME_MAX_LENGTH + 1)])('refuses "%s"', (name) => {
    // Act & Assert
    expect(() => {
      assertValidName(name);
    }).toThrow(NameInvalidError);
  });
});
