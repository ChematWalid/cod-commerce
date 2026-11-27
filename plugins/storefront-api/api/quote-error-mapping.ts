import { PRICING_ERROR_CODES } from '@cod/shared';
import { StorefrontStoreRefusedError } from '@cod/plugin-tenancy';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { QUOTE_CACHE_CONTROL } from '../domain/constants';
import { QuoteRequestInvalidError, QuoteStoreUnavailableError, QuoteTotalTooLargeError } from '../domain/quote-errors';

const LOG_CONTEXT = 'StorefrontQuoteApi';
/** From this status on, the error is the server's fault and is logged. */
const SERVER_FAULT: number = HttpStatus.INTERNAL_SERVER_ERROR;

/** What a refused quote answers: a status and, for a caller's mistake, a stable code. */
interface QuoteRefusal {
  readonly status: number;
  readonly code?: string;
}

/** The part of the HTTP response the filter writes. */
interface FilterResponse {
  headersSent?: boolean;
  setHeader(name: string, value: string): void;
  status(code: number): { end(): void; json(body: unknown): void };
}

/** The answer a caught error gets: only storefront-api errors carry a code (D3303). */
export function quoteRefusalOf(error: unknown): QuoteRefusal {
  if (error instanceof QuoteRequestInvalidError) return { status: HttpStatus.BAD_REQUEST, code: error.code };
  if (error instanceof QuoteTotalTooLargeError) {
    return { status: HttpStatus.UNPROCESSABLE_ENTITY, code: PRICING_ERROR_CODES.TOTAL_TOO_LARGE };
  }
  if (error instanceof QuoteStoreUnavailableError || error instanceof StorefrontStoreRefusedError) {
    return { status: HttpStatus.NOT_FOUND };
  }
  if (error instanceof HttpException && error.getStatus() < SERVER_FAULT) return { status: error.getStatus() };
  return { status: HttpStatus.INTERNAL_SERVER_ERROR };
}

/**
 * The one error mapping of the storefront quote API (D3303): a refused body answers 400 and an oversized total 422,
 * each with `{ code }` only; a refused or unavailable store answers an empty 404, like the catalog, so a caller cannot
 * tell an unknown store from a foreign one; anything else answers an empty 500, logged by class name only (its
 * message could hold SQL or a value). Refusals are never cached. Rate-limit refusals have their own filter first.
 */
@Catch()
export class StorefrontQuoteErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const refusal = quoteRefusalOf(error);
    if (refusal.status >= SERVER_FAULT) {
      Logger.error(`A storefront quote failed: ${error instanceof Error ? error.name : typeof error}`, LOG_CONTEXT);
    }
    const response = host.switchToHttp().getResponse<FilterResponse>();
    if (response.headersSent === true) return;
    response.setHeader('Cache-Control', QUOTE_CACHE_CONTROL);
    if (refusal.code === undefined) {
      response.status(refusal.status).end();
      return;
    }
    response.status(refusal.status).json({ code: refusal.code });
  }
}
