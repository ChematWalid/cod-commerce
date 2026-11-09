import { DomainError } from '@cod/shared';
import { I18nError, LogLevel } from '@vendure/core';

/** A refusal as GraphQL clients see it: `extensions.code` is the domain error's stable code. */
export class RbacApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: these are refusals of the caller's input, not faults of the server.
    super(error.message, {}, error.code, LogLevel.Info);
  }
}

/** Runs a handler body with the plugin's one domain-to-API error mapping (§3a.8). */
export async function withRbacErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error: unknown) {
    throw error instanceof DomainError ? new RbacApiError(error) : error;
  }
}
