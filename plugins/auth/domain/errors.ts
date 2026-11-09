import { AUTH_ERROR_CODES, DomainError } from '@cod/shared';

/** A token that is unknown, expired or already used. One class and one message, so the three cannot be told apart. */
export class InvalidTokenError extends DomainError {
  readonly code = AUTH_ERROR_CODES.INVALID_TOKEN;

  constructor() {
    super('This link is invalid or has expired');
  }
}

/** A wrong or expired one-time code. */
export class OtpInvalidError extends DomainError {
  readonly code = AUTH_ERROR_CODES.OTP_INVALID;

  constructor() {
    super('This code is invalid or has expired');
  }
}

/** Too many wrong guesses: the code stays refused until a new one is issued. */
export class OtpLockedError extends DomainError {
  readonly code = AUTH_ERROR_CODES.OTP_LOCKED;

  constructor() {
    super('Too many wrong codes; request a new one');
  }
}

/** Registration of an email an account already holds. Disclosed on purpose, in this flow only (D27). */
export class EmailTakenError extends DomainError {
  readonly code = AUTH_ERROR_CODES.EMAIL_TAKEN;

  constructor() {
    super('An account with this email already exists');
  }
}

/** The sign-up challenge said this is not a person. */
export class ChallengeFailedError extends DomainError {
  readonly code = AUTH_ERROR_CODES.CHALLENGE_FAILED;

  constructor() {
    super('The sign-up challenge failed');
  }
}

/** A password outside the policy (D37). */
export class PasswordPolicyError extends DomainError {
  readonly code = AUTH_ERROR_CODES.PASSWORD_POLICY;

  constructor() {
    super('The password does not meet the policy');
  }
}

/** A registration that fails the shared schema. It names the fields and never their values. */
export class RegistrationInvalidError extends DomainError {
  readonly code = AUTH_ERROR_CODES.REGISTRATION_INVALID;

  constructor(fields: readonly string[]) {
    super(`Invalid registration fields: ${fields.join(', ')}`);
  }
}

/** A new email address that is not one. */
export class EmailInvalidError extends DomainError {
  readonly code = AUTH_ERROR_CODES.EMAIL_INVALID;

  constructor() {
    super('This email address is not valid');
  }
}

/** The current password given to confirm a change is wrong. */
export class CurrentPasswordWrongError extends DomainError {
  readonly code = AUTH_ERROR_CODES.CURRENT_PASSWORD_WRONG;

  constructor() {
    super('The current password is wrong');
  }
}

/** A repeat of a mailing inside its cooldown (D26). */
export class CooldownError extends DomainError {
  readonly code = AUTH_ERROR_CODES.COOLDOWN;

  constructor() {
    super('Please wait before asking again');
  }
}

/** A profile save that fails the shared schema. It names the fields and never their values. */
export class ProfileInvalidError extends DomainError {
  readonly code = AUTH_ERROR_CODES.PROFILE_INVALID;

  constructor(fields: readonly string[]) {
    super(`Invalid profile fields: ${fields.join(', ')}`);
  }
}

/** A logo over the size limit (D34). */
export class LogoTooLargeError extends DomainError {
  readonly code = AUTH_ERROR_CODES.LOGO_TOO_LARGE;

  constructor() {
    super('The logo is too large');
  }
}

/** A logo whose bytes are not an accepted image format. */
export class LogoTypeError extends DomainError {
  readonly code = AUTH_ERROR_CODES.LOGO_TYPE;

  constructor() {
    super('The logo must be a PNG, JPEG, GIF or WebP image');
  }
}

/** A session whose user has no administrator. No login produces one, so this is a fault, not a refusal. */
export class ProfileMissingError extends Error {
  constructor() {
    super('The signed-in user has no administrator profile');
  }
}
