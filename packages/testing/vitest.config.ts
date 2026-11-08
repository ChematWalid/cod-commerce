import { unitPreset } from '@cod/config/vitest/unit';
import { defineConfig } from 'vitest/config';

/** Unit tests of the helpers that need no database (`pnpm test`). */
export default defineConfig(unitPreset);
