import { describe, expect, it } from 'vitest';
import { buildAuthConfig } from '../../src/config/auth.config';
import type { AppEnv } from '../../src/config/env';

const env = {
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'synthetic-password',
  COOKIE_SECRET: 'synthetic-cookie-secret',
} as AppEnv;

describe('buildAuthConfig', () => {
  it('keeps a session for thirty days', () => {
    expect(buildAuthConfig(env).sessionDuration).toBe('30d');
  });
});
