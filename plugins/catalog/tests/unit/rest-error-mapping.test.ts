import { RateLimitedError, RateLimitedFilter } from '@cod/plugin-rate-limit';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { ForbiddenError } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { CATALOG_REST_CONTROLLERS } from '../../catalog.plugin';
import { CatalogRestErrorFilter, restCall } from '../../api/error-mapping';

/** Where Nest keeps the filters `@UseFilters` declares on a controller. */
const EXCEPTION_FILTERS_METADATA = '__exceptionFilters__';

describe('the REST error mapping', () => {
  it('answers 403 for a Vendure permission refusal a use case rethrows, not a generic 500', async () => {
    // Act
    const answering = restCall(() => Promise.reject(new ForbiddenError()));

    // Assert
    await expect(answering).rejects.toBeInstanceOf(ForbiddenException);
    await expect(answering).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
  });

  it('passes an over-limit refusal on unchanged, for the rate-limit filter to answer 429 (D2138)', async () => {
    // Arrange
    const refusal = new RateLimitedError(30);

    // Act
    const answering = restCall(() => Promise.reject(refusal));

    // Assert
    await expect(answering).rejects.toBe(refusal);
  });

  it.each(CATALOG_REST_CONTROLLERS.map((controller) => [controller.name, controller] as const))(
    '%s answers domain refusals and over-limit refusals with their own status',
    (_name, controller) => {
      // Act
      const filters = Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, controller) as readonly unknown[] | undefined;

      // Assert
      expect(filters).toEqual(expect.arrayContaining([CatalogRestErrorFilter, RateLimitedFilter]));
    },
  );
});
