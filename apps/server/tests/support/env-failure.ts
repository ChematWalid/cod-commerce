import { EnvValidationError, loadEnv } from '../../src/config/env';

type RawEnv = Record<string, string | undefined>;

/**
 * The validation error `loadEnv` raises for `env`.
 * @throws Error when `loadEnv` accepts `env`, so a test that expected a refusal fails loudly; rethrows any other error.
 */
export function failureOf(env: RawEnv): EnvValidationError {
  try {
    loadEnv(env);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error('loadEnv accepted an invalid environment');
}

/** The variable names a validation error reports, in order. */
export const issuePaths = (error: EnvValidationError): string[] => error.issues.map((issue) => issue.path);
