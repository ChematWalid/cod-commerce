import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Unit tests: the prefix list and the middleware with fake requests (`pnpm test`). */
export default defineConfig(vendurePreset);
