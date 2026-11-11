import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { decoratorResolverOf, type DecoratorRef } from './decorator-refs';

/** A source file to scan. */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

type ClassNode = ts.ClassDeclaration | ts.ClassExpression;
type Resolve = (call: ts.CallExpression) => DecoratorRef;

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
  'Search',
  'Sse',
]);
const ALLOW = 'Allow';
const ALLOW_MODULE = '@vendure/core';
const REQUIRE_PERMISSION = 'requirePermission';
/** The rbac entry point, or the decorator's own file for a handler inside rbac. */
const REQUIRE_PERMISSION_MODULE = /^@cod\/plugin-rbac$|(^|\/)require-permission\.decorator$/;
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', '.turbo']);
/** Not production server code, but only as a plugin's own folder: `api/dashboard/` is scanned. */
const SKIPPED_PLUGIN_FOLDERS: ReadonlySet<string> = new Set(['tests', 'dashboard']);
const PLUGIN_FOLDER_DEPTH = 2;
const SOURCE_FILE = /(?<!\.d)\.ts$/;
const ANONYMOUS = 'anonymous';

function decoratorCalls(node: ts.Node): readonly ts.CallExpression[] {
  if (!ts.canHaveDecorators(node)) return [];
  return (ts.getDecorators(node) ?? []).map((decorator) => decorator.expression).filter(ts.isCallExpression);
}

const isRequirePermission = (ref: DecoratorRef): boolean =>
  ref.name === REQUIRE_PERMISSION && ref.module !== undefined && REQUIRE_PERMISSION_MODULE.test(ref.module);

const isAllow = (ref: DecoratorRef): boolean => ref.name === ALLOW && ref.module === ALLOW_MODULE;

/** `@Allow()` and `@Allow(...list)` name no permission, so they are not a decision about who may call the handler. */
const namesPermission = (call: ts.CallExpression): boolean =>
  call.arguments.some((argument) => !ts.isSpreadElement(argument));

/**
 * A class-level `requirePermission` writes its `@Allow` on every prototype method that has none of its own: a method's
 * own `@Allow`, even an empty one, survives and wins, and a property is not on the prototype.
 */
function isGuarded(member: ts.ClassElement, classIsGuarded: boolean, resolve: Resolve): boolean {
  const calls = decoratorCalls(member);
  if (calls.some((call) => isRequirePermission(resolve(call)))) return true;
  const allows = calls.filter((call) => isAllow(resolve(call)));
  if (allows.length > 0) return allows.some(namesPermission);
  return classIsGuarded && ts.isMethodDeclaration(member);
}

function nameOfClass(node: ClassNode): string {
  if (node.name !== undefined) return node.name.text;
  const holder = node.parent;
  return ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name) ? holder.name.text : ANONYMOUS;
}

/** Nest registers inherited handlers too, so a handler counts on any class, decorated as a handler class or not. */
function unguardedHandlersOf(node: ClassNode, path: string, resolve: Resolve): string[] {
  const classIsGuarded = decoratorCalls(node).some((call) => isRequirePermission(resolve(call)));
  return node.members.flatMap((member) => {
    const isEntryPoint = decoratorCalls(member).some((call) => ENTRY_POINT_DECORATORS.has(resolve(call).name));
    if (!isEntryPoint || isGuarded(member, classIsGuarded, resolve)) return [];
    return [`${path}: ${nameOfClass(node)}.${member.name?.getText() ?? ANONYMOUS}`];
  });
}

function classesIn(node: ts.Node): ClassNode[] {
  const nested = node.getChildren().flatMap(classesIn);
  return ts.isClassDeclaration(node) || ts.isClassExpression(node) ? [node, ...nested] : nested;
}

/**
 * Every GraphQL or REST entry point with no `@Allow(<permission>)` and no `requirePermission`, on any class at any
 * depth. Vendure lets anyone call a handler without `@Allow`, so a public one must say so with
 * `@Allow(Permission.Public)`. Decorators are resolved through the file's imports: an alias or a namespace still
 * counts, and a look-alike guard declared in the file does not.
 */
export function findUnguardedHandlers(sources: readonly SourceFile[]): string[] {
  return sources.flatMap((source) => {
    const file = ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true);
    const resolve = decoratorResolverOf(file);
    return classesIn(file).flatMap((node) => unguardedHandlersOf(node, source.path, resolve));
  });
}

function sourcesUnder(directory: string, root: string, depth: number): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (!entry.isDirectory()) {
      return SOURCE_FILE.test(entry.name) ? [{ path: relative(root, path), text: readFileSync(path, 'utf8') }] : [];
    }
    const isPluginFolder = depth === PLUGIN_FOLDER_DEPTH && SKIPPED_PLUGIN_FOLDERS.has(entry.name);
    return isPluginFolder || SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourcesUnder(path, root, depth + 1);
  });
}

/** The production sources of every plugin in the repository at `repoRoot`. */
export const pluginSources = (repoRoot: string): SourceFile[] => sourcesUnder(join(repoRoot, 'plugins'), repoRoot, 1);
