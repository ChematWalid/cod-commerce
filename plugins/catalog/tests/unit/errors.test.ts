import { CATALOG_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { CATALOG_ERROR_CLASSES } from '../../domain/errors';

describe('catalog domain errors', () => {
  it('has exactly one error class per catalog error code', () => {
    // Act
    const codes = CATALOG_ERROR_CLASSES.map((ErrorClass) => new ErrorClass().code);

    // Assert
    expect([...codes].sort()).toEqual(Object.values(CATALOG_ERROR_CODES).sort());
  });
});
