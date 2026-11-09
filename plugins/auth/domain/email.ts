import { DomainError } from '@cod/shared';

/** The transactional emails of the account flows. */
export const AUTH_EMAIL_KINDS = [
  'verification',
  'password-reset',
  'email-change-confirm',
  'email-change-notice',
  'password-changed',
] as const;

export type AuthEmailKind = (typeof AUTH_EMAIL_KINDS)[number];

/** The languages of the account emails (the default is Arabic, `Administrator.customFields.emailLocale`). */
export const AUTH_EMAIL_LOCALES = ['ar', 'en'] as const;

export type AuthEmailLocale = (typeof AUTH_EMAIL_LOCALES)[number];

/** Values a template substitutes. The caller builds every link, so the templates know no routes. */
export type AuthEmailVars = Readonly<Record<string, string>>;

/** The variables each kind must receive: a missing one fails at the call, not in a mailbox. */
export const AUTH_EMAIL_REQUIRED_VARS: Readonly<Record<AuthEmailKind, readonly string[]>> = {
  verification: ['name', 'link', 'code'],
  'password-reset': ['name', 'link'],
  'email-change-confirm': ['name', 'link', 'newEmail'],
  'email-change-notice': ['name', 'newEmail'],
  'password-changed': ['name'],
};

/** What {@link AuthEmailService.enqueue} takes. */
export interface AuthEmailRequest {
  readonly kind: AuthEmailKind;
  readonly to: string;
  readonly locale: AuthEmailLocale;
  readonly vars: AuthEmailVars;
}

/** A rendered message. */
export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** A request that names an unknown kind or locale, or lacks a variable of its kind. */
export class InvalidAuthEmailRequestError extends DomainError {
  readonly code = 'auth.email-invalid-request';

  constructor(detail: string) {
    super(`Invalid auth email request: ${detail}`);
  }
}

/** A delivery attempt failed. It names the kind and a hash of the recipient, never the address or the body. */
export class AuthEmailDeliveryError extends Error {
  constructor(
    readonly kind: AuthEmailKind | 'unreadable',
    readonly recipientHash: string | null,
    readonly reason: string,
  ) {
    super(`Auth email delivery failed (${kind})`);
    this.name = 'AuthEmailDeliveryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function includes<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function stringVars(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  return entries.every(([, entry]) => typeof entry === 'string') ? (value as Record<string, string>) : undefined;
}

/**
 * Checks a value read from the queue or a caller against the request shape.
 *
 * @throws InvalidAuthEmailRequestError naming what is wrong, never a value.
 */
export function parseAuthEmailRequest(value: unknown): AuthEmailRequest {
  if (!isRecord(value)) {
    throw new InvalidAuthEmailRequestError('not an object');
  }
  const { kind, to, locale } = value;
  const vars = stringVars(value['vars']);
  if (!includes(AUTH_EMAIL_KINDS, kind)) {
    throw new InvalidAuthEmailRequestError('unknown kind');
  }
  if (!includes(AUTH_EMAIL_LOCALES, locale)) {
    throw new InvalidAuthEmailRequestError('unknown locale');
  }
  if (typeof to !== 'string' || to.trim() === '' || vars === undefined) {
    throw new InvalidAuthEmailRequestError('recipient or variables malformed');
  }
  const missing = AUTH_EMAIL_REQUIRED_VARS[kind].filter((name) => (vars[name] ?? '') === '');
  if (missing.length > 0) {
    throw new InvalidAuthEmailRequestError(`${kind} lacks ${missing.join(', ')}`);
  }
  return { kind, to, locale, vars };
}
