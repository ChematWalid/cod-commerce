import { unitPreset } from '@cod/config/vitest/unit';
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Unit tests (`pnpm test`). The cache handler modules read their config (`NEXT_DEPLOYMENT_ID`, `REDIS_URL`)
 * when they load, as Next loads them, so the tests give them one. Nothing connects: the tests pass fakes.
 */
export default mergeConfig(
  unitPreset,
  defineConfig({ test: { env: { NEXT_DEPLOYMENT_ID: 'unit', REDIS_URL: 'redis://unit.invalid:6379' } } }),
);
