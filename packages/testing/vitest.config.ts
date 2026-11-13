import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Unit tests of the helpers that need no database (`pnpm test`); some read Vendure's config, hence its preset. */
export default defineConfig(vendurePreset);
