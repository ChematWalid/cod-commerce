import { LOGIN_THROTTLE_HASH_DOMAIN } from './constants';
import type { SecretHasherPort } from './ports/secret-hasher.port';

/**
 * What the limiter knows an account by: an HMAC, because the username field holds whatever was typed into it,
 * a password included, and limiter keys sit readable in Valkey.
 */
export function loginEmailKey(hasher: SecretHasherPort, normalizedEmail: string): string {
  return hasher.hash(`${LOGIN_THROTTLE_HASH_DOMAIN}${normalizedEmail}`);
}

/** The limiter key of one account on one address (D29). */
export function loginPairKey(emailKey: string, clientIp: string): string {
  return `${emailKey}|${clientIp}`;
}
