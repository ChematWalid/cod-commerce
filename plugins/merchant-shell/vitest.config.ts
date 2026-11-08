import { unitPreset } from '@cod/config/vitest/unit';
import { defineConfig } from 'vitest/config';

/** Unit tests of the framework-free domain (`pnpm test`); the dashboard is covered by the server's browser test. */
export default defineConfig(unitPreset);
