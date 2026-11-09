import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/** A source file to scan. */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

const HANDLER_CLASS_DECORATORS: ReadonlySet<string> = new Set(['Resolver', 'Controller']);
/** Entry points only: a `@ResolveField` runs under the query or mutation that reached it. */
const ENTRY_POINT_DECORATORS: ReadonlySet<string> = new Set([
  'Query',
  'Mutation',
  'Subscription',
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'Options',
  'Head',
  'All',
]);
const ALLOW = 'Allow';
const REQUIRE_PERMISSION = 'requirePermission';
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'tests', 'dashboard', '.turbo']);
const SOURCE_FILE = /(?<!\.d)\.ts$/;

function decoratorCalls(node: ts.HasDecorators): readonly ts.CallExpression[] {
  return (ts.getDecorators(node) ?? []).map((decorator) => decorator.expression).filter(ts.isCallExpression);
}

const nameOf = (call: ts.CallExpression): string => (ts.isIdentifier(call.expression) ? call.expression.text : '');

/** `@Allow()` with no permission is not a decision about who may call the handler. */
const declaresPermission = (call: ts.CallExpression): boolean =>
  nameOf(call) === REQUIRE_PERMISSION || (nameOf(call) === ALLOW && call.arguments.length > 0);

function unguardedHandlersOf(node: ts.ClassDeclaration, source: SourceFile): string[] {
  const classCalls = decoratorCalls(node);
  const isHandlerClass = classCalls.some((call) => HANDLER_CLASS_DECORATORS.has(nameOf(call)));
  if (!isHandlerClass || classCalls.some((call) => nameOf(call) === REQUIRE_PERMISSION)) return [];
  return node.members.filter(ts.isMethodDeclaration).flatMap((method) => {
    const calls = decoratorCalls(method);
    const isEntryPoint = calls.some((call) => ENTRY_POINT_DECORATORS.has(nameOf(call)));
    if (!isEntryPoint || calls.some(declaresPermission)) return [];
    return [`${source.path}: ${node.name?.text ?? 'anonymous'}.${method.name.getText()}`];
  });
}

/**
 * Every resolver or controller entry point with no `@Allow` and no `requirePermission`. Vendure lets anyone call a
 * handler without `@Allow`, so a public one must say so with `@Allow(Permission.Public)`.
 */
export function findUnguardedHandlers(sources: readonly SourceFile[]): string[] {
  return sources.flatMap((source) => {
    const file = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true);
    return file.statements.filter(ts.isClassDeclaration).flatMap((node) => unguardedHandlersOf(node, source));
  });
}

function sourcesUnder(directory: string, root: string): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourcesUnder(path, root);
    return SOURCE_FILE.test(entry.name) ? [{ path: relative(root, path), text: readFileSync(path, 'utf8') }] : [];
  });
}

/** The production sources of every plugin in the repository at `repoRoot`. */
export const pluginSources = (repoRoot: string): SourceFile[] => sourcesUnder(join(repoRoot, 'plugins'), repoRoot);
