import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// An ES module (it runs as a bin); this CommonJS test file can only load it dynamically.
type OwnDiagnostics = typeof import('../typecheck/own-sources.mjs').ownDiagnostics;
const ownDiagnostics: (...args: Parameters<OwnDiagnostics>) => Promise<ReturnType<OwnDiagnostics>> = async (path) =>
  (await import('../typecheck/own-sources.mjs')).ownDiagnostics(path);

const scratch = mkdtempSync(join(tmpdir(), 'cod-typecheck-own-'));

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** A project whose own file imports a package that ships TypeScript source with a type error. */
const writeProject = (ownSource: string): string => {
  const root = mkdtempSync(join(scratch, 'project-'));
  const dependency = join(root, 'node_modules/dep');
  mkdirSync(dependency, { recursive: true });
  writeFileSync(join(dependency, 'package.json'), JSON.stringify({ name: 'dep', types: './index.ts' }));
  writeFileSync(join(dependency, 'index.ts'), "export const dep: number = 'not a number';\n");
  writeFileSync(join(root, 'own.ts'), `import { dep } from 'dep';\nexport const total = dep + 1;\n${ownSource}`);
  writeFileSync(
    join(root, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { strict: true, noEmit: true, moduleResolution: 'bundler', module: 'ESNext' } }),
  );
  return join(root, 'tsconfig.json');
};

describe('ownDiagnostics', () => {
  it('ignores type errors in TypeScript sources a dependency ships', async () => {
    await expect(ownDiagnostics(writeProject(''))).resolves.toEqual([]);
  });

  it('reports type errors in the project own files', async () => {
    const diagnostics = await ownDiagnostics(writeProject("export const broken: number = 'x';\n"));

    expect(diagnostics.map((diagnostic) => diagnostic.file?.fileName.endsWith('own.ts'))).toEqual([true]);
  });
});

describe('cod-typecheck-own bin', () => {
  /** Runs the bin through a symlink, the way pnpm's node_modules/.bin reaches it. */
  const runBin = (tsconfigPath: string): { status: number | null; stderr: string } => {
    const link = join(mkdtempSync(join(scratch, 'bin-')), 'cod-typecheck-own');
    symlinkSync(resolve(__dirname, '../typecheck/cod-typecheck-own.mts'), link);
    const result = spawnSync(process.execPath, [link, tsconfigPath], { encoding: 'utf8' });
    return { status: result.status, stderr: result.stderr };
  };

  it('exits 1 and names the file when the project has a type error', () => {
    const { status, stderr } = runBin(writeProject("export const broken: number = 'x';\n"));

    expect(status).toBe(1);
    expect(stderr).toContain('own.ts');
  });

  it('exits 0 when only a dependency has type errors', () => {
    expect(runBin(writeProject('')).status).toBe(0);
  });
});
