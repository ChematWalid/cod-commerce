import { MAX_PRODUCT_HIGHLIGHTS, productPatchSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { parseInput } from '../../api/request-body';
import { InvalidCatalogInputError, TooManyHighlightsError } from '../../domain/errors';
import { newId } from '../support/builders';

describe('parseInput', () => {
  it('refuses a seventh highlight with the highlight code, not a generic one (AC3)', () => {
    // Arrange
    const highlightIds = Array.from({ length: MAX_PRODUCT_HIGHLIGHTS + 1 }, () => newId());

    // Act
    const parsing = () => parseInput(productPatchSchema, { highlightIds });

    // Assert
    expect(parsing).toThrow(TooManyHighlightsError);
  });

  it('refuses any other shape with the generic invalid-input code', () => {
    // Act
    const parsing = () => parseInput(productPatchSchema, { price: 'free' });

    // Assert
    expect(parsing).toThrow(InvalidCatalogInputError);
  });

  it('returns the parsed value when the input is valid', () => {
    // Act
    const parsed = parseInput(productPatchSchema, { label: ' New ' });

    // Assert
    expect(parsed).toEqual({ label: 'New' });
  });
});
