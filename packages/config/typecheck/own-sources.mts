#!/usr/bin/env node
import console from 'node:console';
import { realpathSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const NODE_MODULES_SEGMENT = `${sep}node_modules${sep}`;

/**
 * Type-checks a project and keeps only the diagnostics of the workspace's own files.
 *
 * Why: `@vendure/dashboard` publishes its TypeScript source as its types (`"types": "./src/lib/index.ts"`),
 * so every program that imports it also checks the dashboard's own files. Those are not clean under our
 * strict settings (nor under the 3.8.1 scaffold's), and `skipLibCheck` only skips `.d.ts` files. Global
 * diagnostics (options, missing files) are always kept.
 */
export function ownDiagnostics(tsconfigPath: string): readonly ts.Diagnostic[] {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    resolve(tsconfigPath),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );
  if (!parsed) {
    throw new Error(`cannot read ${tsconfigPath}`);
  }
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  return [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter(
    (diagnostic) => !diagnostic.file?.fileName.split('/').join(sep).includes(NODE_MODULES_SEGMENT),
  );
}

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (fileName) => fileName,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n',
};

// pnpm runs the bin through a node_modules symlink, so compare real paths.
const isEntryPoint =
  process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (isEntryPoint) {
  const tsconfigPath = process.argv[2];
  if (!tsconfigPath) {
    console.error('usage: cod-typecheck-own <tsconfig.json>');
    process.exit(64);
  }
  const diagnostics = ownDiagnostics(tsconfigPath);
  if (diagnostics.length > 0) {
    console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
    console.error(`${String(diagnostics.length)} error(s) in ${relative(process.cwd(), resolve(tsconfigPath))}`);
    process.exit(1);
  }
}
