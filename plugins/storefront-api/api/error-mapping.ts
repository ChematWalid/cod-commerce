import { StorefrontStoreRefusedError } from '@cod/plugin-tenancy';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Logger } from '@vendure/core';

const LOG_CONTEXT = 'StorefrontCatalogApi';
/** From this status on, the error is the server's fault and is logged. */
const SERVER_FAULT: number = HttpStatus.INTERNAL_SERVER_ERROR;

/** An unknown, hidden, draft or other store's product or collection, or a malformed id or slug (D2136). */
export class StorefrontNotFoundError extends Error {
  constructor() {
    super('storefront resource not found');
    this.name = 'StorefrontNotFoundError';
  }
}

/** The part of the HTTP response the filter writes. */
interface FilterResponse {
  headersSent?: boolean;
  status(code: number): { end(): void };
}

/** The status a caught error answers with: nothing about the error itself ever reaches the body. */
function statusOf(error: unknown): number {
  if (error instanceof StorefrontNotFoundError || error instanceof StorefrontStoreRefusedError) {
    return HttpStatus.NOT_FOUND;
  }
  if (error instanceof HttpException) return error.getStatus();
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/**
 * The one error mapping of the storefront catalog API: "not found" and a refused store answer 404 with an empty body,
 * like the internal-only middleware (D112), so a caller cannot tell a hidden product from a foreign one; any other
 * error keeps its HTTP status, or 500, also with an empty body, and a server fault is logged by its class name only
 * (its message could hold SQL or a value). Rate-limit refusals are answered by their own method-level filter first.
 */
@Catch()
export class StorefrontErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const status = statusOf(error);
    if (status >= SERVER_FAULT) {
      Logger.error(
        `A storefront catalog call failed: ${error instanceof Error ? error.name : typeof error}`,
        LOG_CONTEXT,
      );
    }
    const response = host.switchToHttp().getResponse<FilterResponse>();
    if (response.headersSent === true) return;
    response.status(status).end();
  }
}

/** `value`, or a {@link StorefrontNotFoundError} when it is `undefined`. */
export function found<T>(value: T | undefined): T {
  if (value === undefined) throw new StorefrontNotFoundError();
  return value;
}
