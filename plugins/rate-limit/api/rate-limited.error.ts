import { I18nError, LogLevel } from '@vendure/core';
import { RATE_LIMITED_CODE } from '../domain/constants';

/**
 * A request over its limit (D30). GraphQL clients read `extensions.code` and `extensions.retryAfterSeconds`;
 * REST clients get status 429 from {@link RateLimitedFilter}. The message is English, for API users: the
 * dashboard maps the code to a translation.
 */
export class RateLimitedError extends I18nError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    // Info: a refusal of an over-eager caller, not a fault of the server.
    super('Too many requests. Try again later.', {}, RATE_LIMITED_CODE, LogLevel.Info);
    this.retryAfterSeconds = retryAfterSeconds;
    Object.assign(this.extensions, { retryAfterSeconds });
  }
}
