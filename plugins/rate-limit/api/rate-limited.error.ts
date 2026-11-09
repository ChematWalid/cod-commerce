import { I18nError, LogLevel } from '@vendure/core';
import { RATE_LIMITED_CODE } from '../domain/constants';

const DEFAULT_MESSAGE = 'Too many requests. Try again later.';

/**
 * A request over its limit (D30). GraphQL clients read `extensions.code` and `extensions.retryAfterSeconds`;
 * REST clients get status 429 from {@link RateLimitedFilter}. The default message is English, for API users: the
 * dashboard maps the code to a translation. A caller whose client shows the message passes its own i18n key.
 */
export class RateLimitedError extends I18nError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = DEFAULT_MESSAGE) {
    // Info: a refusal of an over-eager caller, not a fault of the server.
    super(message, {}, RATE_LIMITED_CODE, LogLevel.Info);
    this.retryAfterSeconds = retryAfterSeconds;
    Object.assign(this.extensions, { retryAfterSeconds });
  }
}
