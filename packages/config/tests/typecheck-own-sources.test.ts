import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
