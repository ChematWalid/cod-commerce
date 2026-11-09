import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { parseContext } from '@vendure/core';
import { RateLimitedError } from './rate-limited.error';

/**
 * Answers a {@link RateLimitedError} with `Retry-After` on both surfaces (D30). REST gets status 429. GraphQL
 * keeps status 200, because Apollo owns it, and the error travels in the body as Vendure's own filter does it.
 * Without this filter Vendure's would map the error's unknown code to a 500 on a REST route.
 */
@Catch(RateLimitedError)
export class RateLimitedFilter implements ExceptionFilter<RateLimitedError> {
  catch(error: RateLimitedError, host: ArgumentsHost): RateLimitedError | undefined {
    const { res, req, isGraphQL } = parseContext(host);
    res.setHeader('Retry-After', String(error.retryAfterSeconds));
    if (isGraphQL) {
      return error;
    }
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
      path: req.url,
    });
    return undefined;
  }
}
