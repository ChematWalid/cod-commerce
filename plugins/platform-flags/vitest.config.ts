import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Unit tests: flag evaluation and rollout (`pnpm test`). */
export default defineConfig(vendurePreset);
