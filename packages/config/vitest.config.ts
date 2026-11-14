import { defineConfig, mergeConfig } from 'vitest/config';
import { unitPreset } from './vitest/unit';

/**
 * This package's tests scan the whole repository, build TypeScript programs and load the root ESLint config. Each
 * takes about a second alone but went past vitest's 5 s default when every package ran at once
 * (`turbo run test --force`, review of P2.S1 task 5), so they get a budget sized for a loaded machine.
 */
const REPO_SCAN_TEST_TIMEOUT_MS = 30_000;

export default mergeConfig(unitPreset, defineConfig({ test: { testTimeout: REPO_SCAN_TEST_TIMEOUT_MS } }));
