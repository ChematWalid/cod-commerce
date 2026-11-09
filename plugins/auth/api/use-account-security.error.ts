import { AUTH_ERROR_CODES } from '@cod/shared';
import { I18nError, LogLevel } from '@vendure/core';
import { USE_ACCOUNT_SECURITY_MESSAGE } from '../domain/constants';

/** A stock profile save that tried to change the email or password, which only the account flows may do (D38). */
export class UseAccountSecurityError extends I18nError {
  constructor() {
    super(USE_ACCOUNT_SECURITY_MESSAGE, {}, AUTH_ERROR_CODES.USE_ACCOUNT_SECURITY, LogLevel.Info);
  }
}
