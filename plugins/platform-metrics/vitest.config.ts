import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Unit tests: no data service needed (`pnpm test`). The gauges are read from fakes. */
export default defineConfig(vendurePreset);
