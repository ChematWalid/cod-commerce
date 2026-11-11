import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { TEMPLATE_HOLE, withoutSqlComments } from './sql-text';
import { FORBIDDEN_SQL } from './tenant-sql-rules';

/** A string in the sources that opens session-scoped Postgres state. */
export interface TenantSqlViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
}

/** Where SQL can live, relative to the repository root. */
const SCANNED_ROOTS = ['plugins', 'apps/server/src'];

/** TypeScript and JavaScript sources, wherever SQL strings can be written. */
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/;

/** Generated code, skipped at any depth. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.turbo', '.vendure']);

/**
 * A plugin's own `tests/` (which set session state on purpose to prove it leaks) and `dashboard/` (browser code,
 * no SQL), skipped only as direct children of `plugins/<name>/`, so a folder of that name deeper down is scanned.
 */
const SKIPPED_PLUGIN_FOLDERS = new Set(['tests', 'dashboard']);

/** The migrate role's lock runs on a direct connection of its own, which ADR 0016 §6 allows. */
const DIRECT_CONNECTION_EXCEPTIONS: readonly { readonly file: string; readonly rule: string }[] = [
  { file: join('apps', 'server', 'src', 'roles', 'migrate.role.ts'), rule: 'session-advisory-lock' },
];

const isDirectConnectionException = (violation: TenantSqlViolation): boolean =>
  DIRECT_CONNECTION_EXCEPTIONS.some(({ file, rule }) => file === violation.file && rule === violation.rule);

function stringsOf(source: ts.SourceFile): readonly ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** A template's text with each `${}` hole replaced by an identifier, so a dynamic name keeps its SQL shape. */
function textOf(node: ts.Node): string {
  if (!ts.isTemplateExpression(node)) return (node as ts.StringLiteralLike).text;
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(TEMPLATE_HOLE);
}

const scriptKindOf = (file: string): ts.ScriptKind => (file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/** The forbidden statements in one file's string literals and templates. */
export function findForbiddenSql(file: string, content: string): TenantSqlViolation[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKindOf(file));
  return stringsOf(source).flatMap((node) => {
    const text = withoutSqlComments(textOf(node));
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    return FORBIDDEN_SQL.filter(({ matches }) => matches(text)).map(({ rule }) => ({ file, line, rule }));
  });
}

/** True for `plugins/<name>/tests` and `plugins/<name>/dashboard`, given a path relative to the repository root. */
const isSkippedPluginFolder = (relativePath: string): boolean => {
  const parts = relativePath.split(sep);
  return parts.length === 3 && parts[0] === 'plugins' && SKIPPED_PLUGIN_FOLDERS.has(parts[2] ?? '');
};

function sourceFilesUnder(repoRoot: string, directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const skipped = SKIPPED_DIRECTORIES.has(entry.name) || isSkippedPluginFolder(relative(repoRoot, path));
      return skipped ? [] : sourceFilesUnder(repoRoot, path);
    }
    return SOURCE_FILE.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every violation under `plugins/` and `apps/server/src/`, with paths relative to `repoRoot`. */
export function scanTenantSql(repoRoot: string): TenantSqlViolation[] {
  return SCANNED_ROOTS.flatMap((root) => sourceFilesUnder(repoRoot, join(repoRoot, root)))
    .flatMap((path) => findForbiddenSql(relative(repoRoot, path), readFileSync(path, 'utf8')))
    .filter((violation) => !isDirectConnectionException(violation));
}
