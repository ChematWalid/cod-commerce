import { MAX_PRODUCT_HIGHLIGHTS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { TooManyHighlightsError } from '../../domain/errors';
import { assertHighlightCount } from '../../domain/highlights';

const ids = (count: number): string[] => Array.from({ length: count }, (_, index) => String(index + 1));

describe('assertHighlightCount', () => {
  it('accepts six highlights', () => {
    // Act
    const check = (): void => {
      assertHighlightCount(ids(MAX_PRODUCT_HIGHLIGHTS));
    };

    // Assert
    expect(check).not.toThrow();
  });

  it('refuses seven highlights', () => {
    // Act
    const check = (): void => {
      assertHighlightCount(ids(MAX_PRODUCT_HIGHLIGHTS + 1));
    };

    // Assert
    expect(check).toThrow(TooManyHighlightsError);
  });
});
