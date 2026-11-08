import { describe, expect, it } from 'vitest';
import { DomainInputError, mapDomainError } from '../../api/error-mapping';
import { InvalidNoteTitleError } from '../../domain/errors';

const thrownBy = (run: () => never): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the mapping to throw');
};

describe('mapDomainError', () => {
  it('turns a domain error into an input error with the same code and message', () => {
    // Arrange
    const domainError = new InvalidNoteTitleError();

    // Act
    const mapped = thrownBy(() => mapDomainError(domainError));

    // Assert
    expect(mapped).toBeInstanceOf(DomainInputError);
    expect(mapped).toMatchObject({ code: 'TEMPLATE_NOTE_INVALID_TITLE', message: domainError.message });
  });

  it('rethrows any other error unchanged', () => {
    // Arrange
    const bug = new TypeError('a bug');

    // Act
    const mapped = thrownBy(() => mapDomainError(bug));

    // Assert
    expect(mapped).toBe(bug);
  });
});
