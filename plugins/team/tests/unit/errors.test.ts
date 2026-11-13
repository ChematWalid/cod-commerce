import { DomainError, TEAM_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { TEAM_ERROR_CLASSES } from '../../domain/errors';

describe('team domain errors', () => {
  it('has exactly one error class per team error code', () => {
    // Act
    const codes = TEAM_ERROR_CLASSES.map((ErrorClass) => new ErrorClass().code);

    // Assert
    expect([...codes].sort()).toEqual(Object.values(TEAM_ERROR_CODES).sort());
  });

  it('makes every team error a DomainError', () => {
    // Act and assert
    for (const ErrorClass of TEAM_ERROR_CLASSES) {
      expect(new ErrorClass()).toBeInstanceOf(DomainError);
    }
  });
});
