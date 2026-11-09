import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP_LENGTH } from '@cod/shared';
import { ACCOUNT_TOKEN_BYTES, OTP_SPACE } from '../domain/constants';
import type { SecretHasherPort } from '../domain/ports/secret-hasher.port';

/** HMAC-SHA-256 under `AUTH_TOKEN_SECRET`: a bare hash of 10^6 codes would be reversible (D25). */
export class HmacSecretHasher implements SecretHasherPort {
  constructor(private readonly key: string) {}

  newToken(): string {
    return randomBytes(ACCOUNT_TOKEN_BYTES).toString('base64url');
  }

  newOtp(): string {
    return String(randomInt(OTP_SPACE)).padStart(OTP_LENGTH, '0');
  }

  hash(secret: string): string {
    return createHmac('sha256', this.key).update(secret).digest('hex');
  }

  matches(secret: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hash(secret));
    const expected = Buffer.from(expectedHash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
