import { defaultClientConditions, defaultServerConditions } from 'vite';
import type { ViteUserConfig } from 'vitest/config';

/** Suffixes of test files that need infrastructure or a running app; `pnpm test` never runs them. */
const NON_UNIT_SUFFIXES = ['int', 'e2e', 'browser', 'smoke', 'pgbouncer'] as const;

/** Test files are TypeScript, with JSX for the plugin dashboards' components. */
const TEST_EXTENSIONS = '{ts,tsx}';

/**
 * Vitest preset for unit tests: Node environment, sources resolved through the
 * `@cod/source` export condition, and a fixed UTC timezone.
 */
export const unitPreset: ViteUserConfig = {
  // Vite resolves client and server (SSR) graphs with separate condition lists, and a Vitest node
  // environment uses the server one. Both keep Vite's defaults after the workspace source condition.
  resolve: { conditions: ['@cod/source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['@cod/source', ...defaultServerConditions] } },
  test: {
    environment: 'node',
    include: [`tests/**/*.test.${TEST_EXTENSIONS}`],
    exclude: [
      '**/node_modules/**',
      ...NON_UNIT_SUFFIXES.map((suffix) => `tests/**/*.${suffix}.test.${TEST_EXTENSIONS}`),
    ],
    env: { TZ: 'UTC' },
  },
};
