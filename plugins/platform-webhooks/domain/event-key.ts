import { createHash } from 'node:crypto';
import { EVENT_KEY_MAX_LENGTH } from './constants';

/**
 * The dedupe key of a webhook whose provider names no event id: the SHA-256 of the provider, the account and the exact
 * bytes of the body, joined by newlines (D109). The bytes are never re-encoded, so a form-encoded body keys the same
 * however a parser would read it.
 */
export function defaultEventKey(provider: string, accountId: string, rawBody: Buffer): string {
  return createHash('sha256').update(`${provider}\n${accountId}\n`).update(rawBody).digest('hex');
}

/** The key a handler returned if the column holds it, else `null` (the caller then uses {@link defaultEventKey}). */
export function normalizeEventKey(key: string | null | undefined): string | null {
  if (key === null || key === undefined || key === '' || key.length > EVENT_KEY_MAX_LENGTH) return null;
  return key;
}
