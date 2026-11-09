import { AUTH_ERROR_CODES, DomainError } from '@cod/shared';

/** A token that is unknown, expired or already used. One class and one message, so the three cannot be told apart. */
export class InvalidTokenError extends DomainError {
  readonly code = AUTH_ERROR_CODES.INVALID_TOKEN;

  constructor() {
    super('This link is invalid or has expired');
  }
}

/** A wrong or expired one-time code. */
export class OtpInvalidError extends DomainError {
  readonly code = AUTH_ERROR_CODES.OTP_INVALID;

  constructor() {
    super('This code is invalid or has expired');
  }
}

/** Too many wrong guesses: the code stays refused until a new one is issued. */
export class OtpLockedError extends DomainError {
  readonly code = AUTH_ERROR_CODES.OTP_LOCKED;

  constructor() {
    super('Too many wrong codes; request a new one');
  }
}
