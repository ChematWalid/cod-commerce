import { unitPreset } from '@cod/config/vitest/unit';
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Unit tests (`pnpm test`). The cache handler modules read `NEXT_DEPLOYMENT_ID` when they load, as Next
 * loads them, so the tests give them one.
 */
export default mergeConfig(unitPreset, defineConfig({ test: { env: { NEXT_DEPLOYMENT_ID: 'unit' } } }));
