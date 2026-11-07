import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createVitest } from 'vitest/node';
import { afterAll, describe, expect, it } from 'vitest';
import { unitPreset } from '../vitest/unit';
import { vendurePreset } from '../vitest/vendure';

const fixtures = resolve(__dirname, 'fixtures/conditions');
const scratch = mkdtempSync(join(tmpdir(), 'cod-vitest-conditions-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/**
 * Runs the fixture consumer test under the preset the way a workspace package would:
 * the fixture package is symlinked into node_modules, as pnpm links workspace packages.
 */
const runConsumer = async (): Promise<{ passed: boolean; failures: string[] }> => {
  const root = join(scratch, 'consumer');
  mkdirSync(join(root, 'tests'), { recursive: true });
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  cpSync(join(fixtures, 'consumer/origin.fixture.ts'), join(root, 'tests/origin.test.ts'));
  symlinkSync(join(fixtures, 'pkg'), join(root, 'node_modules/cond-fixture'), 'dir');

  const vitest = await createVitest({ root, config: false, watch: false, reporters: [] }, { ...unitPreset });
  try {
    await vitest.start();
    const modules = vitest.state.getTestModules();
    const failures = modules.flatMap((module) => [...module.children.allTests('failed')].map((test) => test.fullName));
    return {
      passed: modules.length > 0 && failures.length === 0 && modules.every((m) => m.state() === 'passed'),
      failures,
    };
  } finally {
    await vitest.close();
  }
};

describe('unit preset export conditions', () => {
  it('resolves a workspace package to its source in the node environment', async () => {
    const result = await runConsumer();

    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(true);
  }, 60_000);
});

describe('vendure preset export conditions', () => {
  it('keeps the unit preset source conditions first, without the bundler-only module condition', () => {
    const serverConditions = vendurePreset.ssr?.resolve?.conditions;

    expect(vendurePreset.resolve?.conditions).toEqual(unitPreset.resolve?.conditions);
    expect(serverConditions?.[0]).toBe('@cod/source');
    expect(serverConditions).toEqual(unitPreset.ssr?.resolve?.conditions?.filter((c) => c !== 'module'));
    expect(serverConditions).not.toContain('module');
  });
});
