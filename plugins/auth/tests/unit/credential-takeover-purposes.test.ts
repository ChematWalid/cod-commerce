import { describe, expect, it } from 'vitest';
import { ACCOUNT_TOKEN_PURPOSES, OTP_PURPOSE } from '../../domain/account-token';
import { CREDENTIAL_TAKEOVER_VOIDED_PURPOSES, NO_SESSION_KEPT } from '../../domain/constants';

describe('CREDENTIAL_TAKEOVER_VOIDED_PURPOSES', () => {
  it('voids every token purpose except the email verification code', () => {
    // Arrange
    const expected = ACCOUNT_TOKEN_PURPOSES.filter((purpose) => purpose !== OTP_PURPOSE);

    // Act
    const voided = [...CREDENTIAL_TAKEOVER_VOIDED_PURPOSES];

    // Assert: a new purpose fails here until someone decides whether a takeover voids it
    expect(voided.sort()).toEqual([...expected].sort());
  });
});

describe('NO_SESSION_KEPT', () => {
  it('is a token no session can hold, so ending the others ends them all', () => {
    // Act and Assert
    expect(NO_SESSION_KEPT).toBe('');
  });
});
