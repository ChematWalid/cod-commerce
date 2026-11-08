import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/** A string in the sources that opens session-scoped Postgres state. */
export interface TenantSqlViolation {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
}

/** Where SQL can live, relative to the repository root. */
const SCANNED_ROOTS = ['plugins', 'apps/server/src'];

/** Generated code, and tests, which set session state on purpose to prove it leaks. */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.turbo', '.vendure', 'tests', 'dashboard']);

/**
 * PgBouncer hands a backend to the next client between transactions, so session state crosses tenants (ADR 0016
 * §6). Keywords match all upper or all lower case: prose such as "Set your subdomain" is not SQL.
 */
const FORBIDDEN_SQL: readonly { readonly rule: string; readonly pattern: RegExp }[] = [
  {
    rule: 'session-set',
    pattern:
      /(?:^|;)\s*(?:SET\s+(?:SESSION\s|(?!LOCAL\b)[\w."]+\s*(?:=|TO\b))|set\s+(?:session\s|(?!local\b)[\w."]+\s*(?:=|to\b)))/,
  },
  { rule: 'session-set-config', pattern: /\bset_config\s*\([^)]*,\s*false\s*\)/i },
  { rule: 'session-advisory-lock', pattern: /\bpg_(?:try_)?advisory_lock(?:_shared)?\s*\(/i },
  { rule: 'listen', pattern: /(?:^|;)\s*(?:LISTEN|listen)\s+\S/ },
];

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
    const text = textOf(node);
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    return FORBIDDEN_SQL.filter(({ pattern }) => pattern.test(text)).map(({ rule }) => ({ file, line, rule }));
  });
}

function sourceFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFilesUnder(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every violation under `plugins/` and `apps/server/src/`, with paths relative to `repoRoot`. */
export function scanTenantSql(repoRoot: string): TenantSqlViolation[] {
  return SCANNED_ROOTS.flatMap((root) => sourceFilesUnder(join(repoRoot, root)))
    .flatMap((path) => findForbiddenSql(relative(repoRoot, path), readFileSync(path, 'utf8')))
    .filter((violation) => !isDirectConnectionException(violation));
}
