import { describe, expect, it } from 'vitest';
import {
  AUTH_ERROR_CODES,
  LOGO_MAX_BYTES,
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  SESSION_DURATION,
} from '../../src/index';

describe('auth constants', () => {
  it('pins the contract values', () => {
    expect(OTP_LENGTH).toBe(6);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    expect(OTP_TTL_MS).toBe(600_000);
    expect(LOGO_MAX_BYTES).toBe(5_242_880);
    expect(SESSION_DURATION).toBe('30d');
  });
  it('namespaces every error code under auth.', () => {
    expect(Object.values(AUTH_ERROR_CODES)).toHaveLength(18);
    for (const code of Object.values(AUTH_ERROR_CODES)) expect(code.startsWith('auth.')).toBe(true);
  });
});
