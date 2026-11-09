import { AUTH_ERROR_CODES, passwordSchema } from '@cod/shared';
import type { PasswordValidationStrategy, RequestContext } from '@vendure/core';

/** Holds Vendure's own password paths to the shared policy (D37). */
export class AccountPasswordValidationStrategy implements PasswordValidationStrategy {
  validate(_ctx: RequestContext, password: string): boolean | string {
    return passwordSchema.safeParse(password).success ? true : AUTH_ERROR_CODES.PASSWORD_POLICY;
  }
}
