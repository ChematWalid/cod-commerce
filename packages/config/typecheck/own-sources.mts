import { resolve, sep } from 'node:path';
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
