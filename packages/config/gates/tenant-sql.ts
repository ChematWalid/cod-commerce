import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

/** A string in the sources that opens session-scoped Postgres state. */
export interface TenantSqlViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
}

/** Where SQL can live, relative to the repository root. */
const SCANNED_ROOTS = ['plugins', 'apps/server/src'];

/** Generated code, skipped at any depth. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.turbo', '.vendure']);

/**
 * A plugin's own `tests/` (which set session state on purpose to prove it leaks) and `dashboard/` (browser code,
 * no SQL), skipped only as direct children of `plugins/<name>/`, so a folder of that name deeper down is scanned.
 */
const SKIPPED_PLUGIN_FOLDERS = new Set(['tests', 'dashboard']);

/** A session `SET`: the forms without `=`/`TO`, or an assignment that is not `SET LOCAL`. */
const SESSION_SET = /(?:^|;)\s*SET\s+(?:(?:SESSION|ROLE|SCHEMA|NAMES|TIME\s+ZONE)\s|(?!LOCAL\b)[\w."]+\s*(?:=|TO\b))/i;

/**
 * PgBouncer hands a backend to the next client between transactions, so session state crosses tenants (ADR 0016
 * §6). Keywords match in any letter case; each pattern needs SQL shape (an assignment, a name then `AS`, a
 * statement end), so prose such as "Set your subdomain" or "Listen to the webhook" does not match.
 */
const FORBIDDEN_SQL: readonly { readonly rule: string; readonly pattern: RegExp }[] = [
  { rule: 'session-set', pattern: SESSION_SET },
  { rule: 'session-set-config', pattern: /\bset_config\s*\(.*?,\s*false\s*\)/is },
  { rule: 'session-advisory-lock', pattern: /\bpg_(?:try_)?advisory_lock(?:_shared)?\s*\(/i },
  { rule: 'listen', pattern: /(?:^|;)\s*LISTEN\s+[\w"]+\s*(?:;|$)/i },
  {
    rule: 'temporary-table',
    pattern: /\bCREATE\s+(?:(?:GLOBAL|LOCAL)\s+)?(?:TEMP|TEMPORARY)\s+TABLE\b(?![^;]*\bON\s+COMMIT\s+DROP\b)/i,
  },
  { rule: 'prepared-statement', pattern: /(?:^|;)\s*PREPARE\s+[\w"]+\s*(?:\(|AS\b)/i },
  { rule: 'cursor-with-hold', pattern: /\bCURSOR\s+WITH\s+HOLD\b/i },
];

/** SQL comments hide nothing: a statement after `-- note` or `/* note *\/` is still a statement. */
const withoutSqlComments = (sql: string): string => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

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

/** A template's text with its `${}` holes replaced, so a keyword after a hole is still seen. */
function textOf(node: ts.Node): string {
  if (!ts.isTemplateExpression(node)) return (node as ts.StringLiteralLike).text;
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('$');
}

/** The forbidden statements in one file's string literals and templates. */
export function findForbiddenSql(file: string, content: string): TenantSqlViolation[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return stringsOf(source).flatMap((node) => {
    const text = withoutSqlComments(textOf(node));
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    return FORBIDDEN_SQL.filter(({ pattern }) => pattern.test(text)).map(({ rule }) => ({ file, line, rule }));
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
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every violation under `plugins/` and `apps/server/src/`, with paths relative to `repoRoot`. */
export function scanTenantSql(repoRoot: string): TenantSqlViolation[] {
  return SCANNED_ROOTS.flatMap((root) => sourceFilesUnder(repoRoot, join(repoRoot, root)))
    .flatMap((path) => findForbiddenSql(relative(repoRoot, path), readFileSync(path, 'utf8')))
    .filter((violation) => !isDirectConnectionException(violation));
}
