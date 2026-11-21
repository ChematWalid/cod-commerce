import { DomainError, PRICING_ERROR_CODES } from '@cod/shared';
import { HttpStatus, InternalServerErrorException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OffersRestErrorFilter, restCall, restStatusOf, withOffersErrors } from '../../api/error-mapping';
import { OfferPublishInvalidError } from '../../domain/errors';

/** A buyer or merchant value a database message may quote. */
const QUOTED_VALUE = 'synthetic-offer-title-42';

/** A domain error carrying `code`, as a use case would throw it. */
class CodedError extends DomainError {
  constructor(readonly code: string) {
    super(`refused ${QUOTED_VALUE}`);
  }
}

/** What the REST filter wrote: its status and JSON body. */
interface Written {
  status?: number;
  body?: Record<string, unknown>;
}

/** A Nest host over a request translating with `t` and a response recording what is written. */
function hostRecording(written: Written): ArgumentsHost {
  const res = {
    status: (status: number) => {
      written.status = status;
      return res;
    },
    json: (body: Record<string, unknown>) => {
      written.body = body;
      return res;
    },
  };
  const req = { url: `/offers/1/publish?q=${QUOTED_VALUE}`, t: (key: string) => `translated:${key}` };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getArgs: () => [req, res],
  } as unknown as ArgumentsHost;
}

describe('the offers error mapping (D2520)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(Object.values(PRICING_ERROR_CODES))('maps every pricing error code to a status: %s', (code) => {
    // Act
    const status = restStatusOf(new CodedError(code));

    // Assert
    expect(status).toBeGreaterThanOrEqual(HttpStatus.BAD_REQUEST);
    expect(status).toBeLessThan(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('answers 422 for a target that is no row of the store (D2537)', () => {
    // Act
    const status = restStatusOf(new CodedError('offers.unknown-targets'));

    // Assert
    expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('answers the documented statuses of the admin refusals', () => {
    // Act
    const statuses = [
      PRICING_ERROR_CODES.OFFER_NOT_FOUND,
      PRICING_ERROR_CODES.INVALID_TARGETS,
      PRICING_ERROR_CODES.PUBLISH_INVALID,
      PRICING_ERROR_CODES.OFFER_NOT_DELETABLE,
    ].map((code) => restStatusOf(new CodedError(code)));

    // Assert
    expect(statuses).toEqual([
      HttpStatus.NOT_FOUND,
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.CONFLICT,
    ]);
  });

  it('never echoes input in an error message', async () => {
    // Arrange
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    const fault = new TypeError(`duplicate key value (title)=(${QUOTED_VALUE})`);
    const written: Written = {};

    // Act
    const graphql = await withOffersErrors(() => Promise.reject(fault)).catch((error: unknown) => error);
    const rest = await restCall(() => Promise.reject(fault)).catch((error: unknown) => error);
    const refused = await withOffersErrors(() =>
      Promise.reject(new CodedError(PRICING_ERROR_CODES.INVALID_CONFIG)),
    ).catch((error: unknown) => error);
    new OffersRestErrorFilter().catch(new CodedError(PRICING_ERROR_CODES.INVALID_CONFIG), hostRecording(written));

    // Assert
    expect(rest).toBeInstanceOf(InternalServerErrorException);
    expect(JSON.stringify([String(graphql), String(rest), String(refused), written])).not.toContain(QUOTED_VALUE);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(QUOTED_VALUE);
    expect(written).toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      body: { code: PRICING_ERROR_CODES.INVALID_CONFIG, path: '/offers/1/publish' },
    });
  });

  it('answers publish-invalid with its problem list on both surfaces', async () => {
    // Arrange
    const refusal = new OfferPublishInvalidError(['title', 'targets', 'dates']);
    const written: Written = {};

    // Act
    const graphql = await withOffersErrors(() => Promise.reject(refusal)).catch((error: unknown) => error);
    new OffersRestErrorFilter().catch(refusal, hostRecording(written));

    // Assert
    expect(graphql).toMatchObject({
      extensions: { code: PRICING_ERROR_CODES.PUBLISH_INVALID, problems: ['title', 'targets', 'dates'] },
    });
    expect(written).toMatchObject({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      body: { code: PRICING_ERROR_CODES.PUBLISH_INVALID, problems: ['title', 'targets', 'dates'] },
    });
  });
});
