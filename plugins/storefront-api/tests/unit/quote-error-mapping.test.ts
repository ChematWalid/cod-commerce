import { StorefrontStoreRefusedError } from '@cod/plugin-tenancy';
import { type ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { StorefrontQuoteErrorFilter } from '../../api/quote-error-mapping';
import {
  QuoteRequestInvalidError,
  QuoteStoreUnavailableError,
  QuoteTotalTooLargeError,
} from '../../domain/quote-errors';

/** What the filter wrote. */
interface Written {
  status?: number;
  body?: unknown;
  ended: boolean;
  headers: Record<string, string>;
}

function hostRecording(): { host: ArgumentsHost; written: Written } {
  const written: Written = { ended: false, headers: {} };
  const response = {
    setHeader: (name: string, value: string) => {
      written.headers[name] = value;
    },
    status: (code: number) => {
      written.status = code;
      return {
        end: () => {
          written.ended = true;
        },
        json: (body: unknown) => {
          written.body = body;
          written.ended = true;
        },
      };
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
  return { host, written };
}

const NO_STORE = { 'Cache-Control': 'private, no-store' };

describe('StorefrontQuoteErrorFilter (D3303)', () => {
  it.each([
    ['a refused body', new QuoteRequestInvalidError('pricing.invalid-request'), 400, 'pricing.invalid-request'],
    ['an oversized total', new QuoteTotalTooLargeError(), 422, 'pricing.total-too-large'],
  ])('answers %s with its status and only its code', (_label, error, status, code) => {
    // Arrange
    const { host, written } = hostRecording();

    // Act
    new StorefrontQuoteErrorFilter().catch(error, host);

    // Assert
    expect(written).toEqual({ status, body: { code }, ended: true, headers: NO_STORE });
  });

  it.each([
    ['an unavailable store', new QuoteStoreUnavailableError(), 404],
    ['a refused store', new StorefrontStoreRefusedError(), 404],
    ['an HTTP refusal', new ForbiddenException('secret detail'), 403],
    ['a server fault holding SQL', new Error('relation "fee_group" does not exist'), 500],
  ])('answers %s with its status and an empty body', (_label, error, status) => {
    // Arrange
    const { host, written } = hostRecording();

    // Act
    new StorefrontQuoteErrorFilter().catch(error, host);

    // Assert
    expect(written).toEqual({ status, ended: true, headers: NO_STORE });
  });
});
