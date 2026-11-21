import { RateLimitedFilter } from '@cod/plugin-rate-limit';
import { COLLECTIONS_ERROR_CODES, type DomainError } from '@cod/shared';
import { ForbiddenException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { ChannelNotFoundError, EntityNotFoundError, ForbiddenError } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { COLLECTIONS_REST_CONTROLLERS } from '../../collections-rules.plugin';
import {
  ChannelNotFoundRestFilter,
  CollectionsApiError,
  CollectionsRestErrorFilter,
  restCall,
  restStatusOf,
} from '../../api/error-mapping';
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

  it('answers an unknown channel token with 404 CHANNEL_NOT_FOUND, never a 500', () => {
    // Arrange
    const answer: { status?: number; body?: unknown } = {};
    const res = {
      status: (status: number) => {
        answer.status = status;
        return res;
      },
      json: (body: unknown) => {
        answer.body = body;
      },
    };
    const req = { url: '/catalog/collections?search=x', t: (key: string) => `translated ${key}` };
    const host = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) };

    // Act
    new ChannelNotFoundRestFilter().catch(new ChannelNotFoundError('synthetic-token'), host as never);

    // Assert
    expect(answer).toEqual({
      status: HttpStatus.NOT_FOUND,
      body: {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'CHANNEL_NOT_FOUND',
        message: 'translated error.collections-channel-not-found',
        path: '/catalog/collections',
      },
    });
  });

  it('tells a rate-limited REST caller when to retry with Retry-After', () => {
    // Arrange
    const headers = new Map<string, string>();
    const res = {
      setHeader: (name: string, value: string) => headers.set(name, value),
      status: () => res,
      json: () => undefined,
    };
    const req = { url: '/catalog/collections/preview' };
    const host = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }) };

    // Act
    new CollectionsRestErrorFilter().catch(new errors.CollectionsRateLimitedError(7), host as never);

    // Assert
    expect(headers.get('Retry-After')).toBe('7');
  });

  it('tells a rate-limited GraphQL caller when to retry through extensions.retryAfterSeconds', () => {
    // Act
    const error = new CollectionsApiError(new errors.CollectionsRateLimitedError(7));

    // Assert
    expect(error.extensions).toMatchObject({ code: COLLECTIONS_ERROR_CODES.RATE_LIMITED, retryAfterSeconds: 7 });
  });

  it.each(COLLECTIONS_REST_CONTROLLERS.map((controller) => [controller.name, controller] as const))(
    '%s answers domain, over-limit and unknown-channel refusals with their own status',
    (_name, controller) => {
      // Act
      const filters = Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, controller) as readonly unknown[] | undefined;

      // Assert
      expect(filters).toEqual(
        expect.arrayContaining([CollectionsRestErrorFilter, RateLimitedFilter, ChannelNotFoundRestFilter]),
      );
    },
  );
});
