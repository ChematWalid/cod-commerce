import { DomainError } from '@cod/shared';
import { I18nError, LogLevel } from '@vendure/core';

/**
 * A rejected input, sent to the client as a GraphQL error whose `extensions.code` is the domain error's
 * stable code. Logged at warn level: it is the caller's mistake, not a server fault.
 */
export class DomainInputError extends I18nError {
  constructor(message: string, code: string) {
    super(message, {}, code, LogLevel.Warn);
  }
}

/**
 * The one error mapping of this plugin's Admin API: a {@link DomainError} becomes a {@link DomainInputError}
 * with the same message and code; anything else is rethrown unchanged, for Vendure to log and report.
 */
export function mapDomainError(error: unknown): never {
  if (error instanceof DomainError) {
    throw new DomainInputError(error.message, error.code);
  }
  throw error;
}
