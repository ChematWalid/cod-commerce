import swc from 'unplugin-swc';
import type { ViteUserConfig } from 'vitest/config';
// A self-reference rather than './unit': Node can load it natively, without a file extension, when a
// consumer's Vitest config imports this preset.
import { unitPreset } from '@cod/config/vitest/unit';

/** Vendure tests boot Nest and talk to Postgres and Valkey, which takes far longer than a unit test. */
const VENDURE_TEST_TIMEOUT_MS = 120_000;

/**
 * A bundler-only export condition. Vitest hands the SSR conditions to its worker processes as Node
 * `--conditions`, and there `module` makes a CommonJS `require` load a dual package's ES module build:
 * `@vendure/core` then fails on `i18next-fs-backend`, whose ESM build uses top-level await.
 */
const BUNDLER_ONLY_CONDITION = 'module';

const unitServerConditions = unitPreset.ssr?.resolve?.conditions ?? [];

/**
 * Vitest preset for code that runs under Nest dependency injection (Vendure plugins and the server).
 *
 * It keeps the {@link unitPreset} source resolution (`@cod/source` first in `resolve.conditions` and
 * `ssr.resolve.conditions`) minus the bundler-only `module` condition, and compiles with SWC instead of
 * esbuild, because esbuild cannot emit the decorator metadata that Nest reads to resolve constructor
 * parameters. Test files run one at a time in forked processes: Vendure keeps process-wide state (config,
 * logger) and binds ports.
 */
export const vendurePreset: ViteUserConfig = {
  ...unitPreset,
  ssr: {
    ...unitPreset.ssr,
    resolve: {
      ...unitPreset.ssr?.resolve,
      conditions: unitServerConditions.filter((condition) => condition !== BUNDLER_ONLY_CONDITION),
    },
  },
  plugins: [
    swc.vite({
      tsconfigFile: false,
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        keepClassNames: true,
        transform: { legacyDecorator: true, decoratorMetadata: true, useDefineForClassFields: false },
      },
    }),
  ],
  test: {
    ...unitPreset.test,
    pool: 'forks',
    fileParallelism: false,
    testTimeout: VENDURE_TEST_TIMEOUT_MS,
    hookTimeout: VENDURE_TEST_TIMEOUT_MS,
    // Off until each integration suite is checked in CI (D2118): integration suites cannot run locally (D218), so a
    // suite opts in from its own config, as the template's does.
    expect: { ...unitPreset.test?.expect, requireAssertions: false },
  },
};
