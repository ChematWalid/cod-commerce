import type { INestApplicationContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../../src/config/env';
import { DemoSeedRefusedError, seedDemoBusinesses } from '../../src/seed/seed-demo-businesses';

const noApp = {} as INestApplicationContext;

describe('seedDemoBusinesses', () => {
  it('refuses production before touching anything', async () => {
    // Arrange
    const env = { APP_ENV: 'production', DEMO_OWNER_PASSWORD: 'synthetic-demo-password' } as AppEnv;

    // Act and Assert
    await expect(seedDemoBusinesses(noApp, env)).rejects.toThrow(DemoSeedRefusedError);
  });

  it('refuses to run without an owner password', async () => {
    // Arrange
    const env = { APP_ENV: 'development' } as AppEnv;

    // Act and Assert
    await expect(seedDemoBusinesses(noApp, env)).rejects.toThrow(DemoSeedRefusedError);
  });
});
