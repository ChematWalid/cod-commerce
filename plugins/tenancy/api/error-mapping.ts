import { DomainError } from '@cod/shared';
import { I18nError, LogLevel } from '@vendure/core';

/** A domain error as GraphQL clients see it: `extensions.code` is the domain error's stable code. */
class TenancyApiError extends I18nError {
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
    throw error instanceof DomainError ? new TenancyApiError(error) : error;
  }
}
