import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');
interface TurboConfig {
  tasks: Record<string, { outputs?: string[] }>;
}
const readJson = (path: string): TurboConfig => JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as TurboConfig;

describe('turbo build cache outputs', () => {
  it('root build outputs carry no negation (a negation applies to every package)', () => {
    // A root-wide `!dist/dashboard/**` dropped plugins/merchant-shell's
    // dist/dashboard/constants.js from the cache (CI run 42434692656).
    const outputs = readJson('turbo.json').tasks.build?.outputs ?? [];
    expect(outputs).toContain('dist/**');
    expect(outputs.filter((o) => o.startsWith('!'))).toEqual([]);
  });

  it('the dashboard exclusion is scoped to the server package', () => {
    const outputs = readJson('apps/server/turbo.json').tasks.build?.outputs ?? [];
    expect(outputs).toEqual(expect.arrayContaining(['dist/**', '!dist/dashboard/**']));
  });
});
