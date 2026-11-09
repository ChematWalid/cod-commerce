import { AUTH_ERROR_CODES, PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { AccountPasswordValidationStrategy } from '../../infrastructure/account-password-validation.strategy';

const ctx = {} as RequestContext;
const strategy = new AccountPasswordValidationStrategy();

describe('AccountPasswordValidationStrategy', () => {
  it('accepts a password within the policy', () => {
    expect(strategy.validate(ctx, 'a'.repeat(PASSWORD_MIN_BYTES))).toBe(true);
  });

  it.each([
    ['short', 'a'.repeat(PASSWORD_MIN_BYTES - 1)],
    ['long', 'a'.repeat(PASSWORD_MAX_BYTES + 1)],
  ])('refuses a %s password with the policy code', (_name, password) => {
    expect(strategy.validate(ctx, password)).toBe(AUTH_ERROR_CODES.PASSWORD_POLICY);
  });
});
