import { DomainError, RBAC_ERROR_CODES } from '@cod/shared';
import { I18nError, LogLevel } from '@vendure/core';

const TRANSLATED_CODES: ReadonlySet<string> = new Set(Object.values(RBAC_ERROR_CODES));

/** The `api/i18n` key of a stable code. i18next reads dots as nesting, so the code's dot becomes a dash. */
export const translationKeyOf = (code: string): string => code.replace('.', '-');

const messageOf = (error: DomainError): string =>
  TRANSLATED_CODES.has(error.code) ? `error.${translationKeyOf(error.code)}` : error.message;

/** A refusal as GraphQL clients see it: `extensions.code` is the domain error's stable code. */
export class RbacApiError extends I18nError {
  constructor(error: DomainError) {
    // Info: these are refusals of the caller's input, not faults of the server.
    super(messageOf(error), {}, error.code, LogLevel.Info);
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
