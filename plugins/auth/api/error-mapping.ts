import { SubdomainInvalidError, SubdomainTakenError } from '@cod/plugin-tenancy';
import { DomainError } from '@cod/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import { I18nError, Logger, LogLevel, parseContext } from '@vendure/core';
import {
  ChallengeFailedError,
  CooldownError,
  CurrentPasswordWrongError,
  EmailInvalidError,
  EmailTakenError,
  InvalidTokenError,
  LogoTooLargeError,
  LogoTypeError,
  OtpInvalidError,
  OtpLockedError,
  PasswordPolicyError,
  ProfileInvalidError,
  RegistrationInvalidError,
} from '../domain/errors';

const LOG_CONTEXT = 'AuthApi';
const INTERNAL_MESSAGE = 'The request could not be completed';

/** The refusals of a caller's input. Any other domain error is a fault of the server and answers 500. */
const REFUSALS: readonly (readonly [abstract new (...args: never[]) => DomainError, HttpStatus])[] = [
  [EmailTakenError, HttpStatus.CONFLICT],
  [SubdomainTakenError, HttpStatus.CONFLICT],
  [ChallengeFailedError, HttpStatus.FORBIDDEN],
  [PasswordPolicyError, HttpStatus.BAD_REQUEST],
  [RegistrationInvalidError, HttpStatus.BAD_REQUEST],
  [ProfileInvalidError, HttpStatus.BAD_REQUEST],
  [LogoTooLargeError, HttpStatus.PAYLOAD_TOO_LARGE],
  [LogoTypeError, HttpStatus.UNSUPPORTED_MEDIA_TYPE],
  [SubdomainInvalidError, HttpStatus.BAD_REQUEST],
  [InvalidTokenError, HttpStatus.BAD_REQUEST],
  [OtpInvalidError, HttpStatus.BAD_REQUEST],
  [EmailInvalidError, HttpStatus.BAD_REQUEST],
  [CurrentPasswordWrongError, HttpStatus.BAD_REQUEST],
  [OtpLockedError, HttpStatus.TOO_MANY_REQUESTS],
  [CooldownError, HttpStatus.TOO_MANY_REQUESTS],
];

/** A domain error as GraphQL clients see it: `extensions.code` is the domain error's stable code. */
class AuthApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: these are refusals of the caller's input, not faults of the server.
    super(error.message, {}, error.code, LogLevel.Info);
  }
}

/** Runs a resolver body with the plugin's one domain-to-GraphQL error mapping (§3a.8). */
export async function withApiErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    throw error instanceof DomainError ? new AuthApiError(error) : error;
  }
}

/** The REST mapping of the same errors: the status from {@link REFUSALS} and the stable code in the body. */
@Catch(DomainError)
export class DomainErrorRestFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const { req, res } = parseContext(host);
    const status = REFUSALS.find(([type]) => error instanceof type)?.[1];
    if (status === undefined) {
      Logger.error(`Domain error with no REST status: ${error.code}`, LOG_CONTEXT);
    }
    res.status(status ?? HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      code: error.code,
      message: status === undefined ? INTERNAL_MESSAGE : error.message,
      path: req.url,
    });
  }
}
