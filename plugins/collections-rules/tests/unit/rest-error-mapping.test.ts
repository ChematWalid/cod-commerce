import { RateLimitedFilter } from '@cod/plugin-rate-limit';
import { COLLECTIONS_ERROR_CODES, type DomainError } from '@cod/shared';
import { ForbiddenException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { EntityNotFoundError, ForbiddenError } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { COLLECTIONS_REST_CONTROLLERS } from '../../collections-rules.plugin';
import { CollectionsRestErrorFilter, restCall, restStatusOf } from '../../api/error-mapping';
import { CorruptCollectionDefinitionError } from '../../domain/corrupt-collection-definition.error';
import * as errors from '../../domain/errors';

/** Where Nest keeps the filters `@UseFilters` declares on a controller. */
const EXCEPTION_FILTERS_METADATA = '__exceptionFilters__';

const domainErrors = Object.values(errors).map((Type) => new (Type as new () => DomainError)());

describe('the collections REST error mapping', () => {
  it('gives every collections code a status of its own, never the 500 of an unmapped code', () => {
    // Act
    const statuses = domainErrors.map((error) => [error.code, restStatusOf(error)] as const);

    // Assert
    expect(statuses.map(([code]) => code).sort()).toEqual(Object.values(COLLECTIONS_ERROR_CODES).sort());
    for (const [, status] of statuses) expect(status).not.toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('answers 404 for not-found, 409 for a taken slug and 429 when rate limited', () => {
    // Act
    const statuses = [
      new errors.CollectionNotFoundError(),
      new errors.CollectionSlugTakenError(),
      new errors.CollectionsRateLimitedError(),
    ].map(restStatusOf);

    // Assert
    expect(statuses).toEqual([HttpStatus.NOT_FOUND, HttpStatus.CONFLICT, HttpStatus.TOO_MANY_REQUESTS]);
  });

  it('answers 403 for a Vendure permission refusal a use case rethrows, not a generic 500', async () => {
    // Act
    const answering = restCall(() => Promise.reject(new ForbiddenError()));

    // Assert
    await expect(answering).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("reads Vendure's entity-not-found as the collection's not-found", async () => {
    // Act
    const answering = restCall(() => Promise.reject(new EntityNotFoundError('Collection', 7)));

    // Assert
    await expect(answering).rejects.toMatchObject({ code: COLLECTIONS_ERROR_CODES.NOT_FOUND });
  });

  it('answers a corrupt stored row as a bare 500 that names neither the row nor the business', async () => {
    // Act
    const answer: unknown = await restCall(() =>
      Promise.reject(new CorruptCollectionDefinitionError('101', '555')),
    ).catch((error: unknown) => error);

    // Assert
    expect(answer).toBeInstanceOf(InternalServerErrorException);
    expect((answer as Error).message).not.toMatch(/101|555/);
  });

  it.each(COLLECTIONS_REST_CONTROLLERS.map((controller) => [controller.name, controller] as const))(
    '%s answers domain refusals and over-limit refusals with their own status',
    (_name, controller) => {
      // Act
      const filters = Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, controller) as readonly unknown[] | undefined;

      // Assert
      expect(filters).toEqual(expect.arrayContaining([CollectionsRestErrorFilter, RateLimitedFilter]));
    },
  );
});
