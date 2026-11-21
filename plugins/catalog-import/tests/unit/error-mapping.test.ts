import { CATALOG_ERROR_CODES, DomainError } from '@cod/shared';
import { HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { restStatusOf } from '../../api/error-mapping';
import ar from '../../api/i18n/ar.json';
import en from '../../api/i18n/en.json';

/** A refusal catalog's facade throws, as the link import's create or polish receive it. */
class CatalogRefusal extends DomainError {
  constructor(readonly code: string) {
    super(code);
  }
}

describe('catalog-import error mapping (D2136, D2272)', () => {
  it("maps catalog's refusals a request-level create or polish can receive, never 500", () => {
    // Act and Assert
    expect(restStatusOf(new CatalogRefusal(CATALOG_ERROR_CODES.INVALID_INPUT))).toBe(HttpStatus.BAD_REQUEST);
    expect(restStatusOf(new CatalogRefusal(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND))).toBe(HttpStatus.NOT_FOUND);
  });

  it("leaves catalog's messages to catalog: no catalog-import catalogue redefines a catalog key", () => {
    // Arrange
    const keysOf = (catalogue: { error: Record<string, string> }): string[] => Object.keys(catalogue.error);

    // Act
    const borrowed = [...keysOf(en), ...keysOf(ar)].filter((key) => !key.startsWith('catalog-import-'));

    // Assert
    expect(borrowed).toEqual([]);
  });
});
