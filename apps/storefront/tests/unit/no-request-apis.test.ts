import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * ADR 0006: a tenant render is cached per store, so it must never read the request. This scans, with the TypeScript
 * AST, every module under `app/%5Ft/**`, `src/theme` and `src/store` and every module they import (relative imports,
 * followed transitively), and fails on any use of `cookies`, `headers` or `draftMode`. The home and product pages
 * must not read the query string either (`searchParams`): a cached page keyed by an unbounded query fills the cache;
 * only listing and search pages read `page`, `sort` and `q`, validated. And no `'use cache'` function reads the theme
 * name itself: it is an argument, so it is part of the cache key (D3207).
 */

const APP_ROOT = resolve(__dirname, '../..');
const SCAN_ROOTS = ['app/%5Ft', 'src/theme', 'src/store', 'src/views', 'src/catalog', 'src/seo'].map((path) =>
  join(APP_ROOT, path),
);
const REQUEST_API_MODULE = 'next/headers';
const REQUEST_API_NAMES: ReadonlySet<string> = new Set(['cookies', 'headers', 'draftMode']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** One forbidden use, as `file: what`. */
type Violation = string;

function sourceFilesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFilesUnder(path);
    return SOURCE_EXTENSIONS.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}

function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`)];
  candidates.push(...SOURCE_EXTENSIONS.map((extension) => join(base, `index${extension}`)));
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function declarationSpecifierOf(node: ts.Node): string | undefined {
  if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) return undefined;
  const specifier = node.moduleSpecifier;
  return specifier !== undefined && ts.isStringLiteral(specifier) ? specifier.text : undefined;
}

function callSpecifierOf(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const first = node.arguments[0];
  const isDynamic = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
  if ((isDynamic || isRequire) && first !== undefined && ts.isStringLiteral(first)) return first.text;
  return undefined;
}

function moduleSpecifierOf(node: ts.Node): string | undefined {
  return declarationSpecifierOf(node) ?? callSpecifierOf(node);
}

function forbiddenNamedImports(node: ts.Node): string[] {
  if (!ts.isImportDeclaration(node)) return [];
  const bindings = node.importClause?.namedBindings;
  if (bindings === undefined || !ts.isNamedImports(bindings)) return [];
  return bindings.elements
    .map((element) => (element.propertyName ?? element.name).text)
    .filter((name) => REQUEST_API_NAMES.has(name));
}

/** The forbidden uses in one source text, and the specifiers it imports. */
function scanSource(fileName: string, text: string): { violations: Violation[]; specifiers: string[] } {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    const specifier = moduleSpecifierOf(node);
    if (specifier !== undefined) specifiers.push(specifier);
    if (specifier === REQUEST_API_MODULE) violations.push(`${fileName}: imports ${REQUEST_API_MODULE}`);
    forbiddenNamedImports(node).forEach((name) => violations.push(`${fileName}: imports ${name}`));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { violations, specifiers };
}

/** Scans one source text: its violations and the specifiers it imports. */
type SourceScanner = (fileName: string, text: string) => { violations: Violation[]; specifiers: string[] };

function scanModuleGraph(
  roots: readonly string[],
  scan: SourceScanner = scanSource,
): { violations: Violation[]; scanned: string[] } {
  const pending = [...roots];
  const seen = new Set<string>();
  const violations: Violation[] = [];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    const result = scan(relative(APP_ROOT, file), readFileSync(file, 'utf8'));
    violations.push(...result.violations);
    result.specifiers
      .filter((specifier) => specifier.startsWith('.'))
      .map((specifier) => resolveRelative(file, specifier))
      .forEach((next) => {
        if (next !== undefined) pending.push(next);
      });
  }
  return { violations, scanned: [...seen] };
}

describe('tenant renders read no request data (ADR 0006)', () => {
  it('finds no cookies, headers or draftMode in the tenant module graph', () => {
    // Arrange
    const roots = SCAN_ROOTS.flatMap(sourceFilesUnder);
    // Act
    const { violations, scanned } = scanModuleGraph(roots);
    // Assert
    expect(scanned.length).toBeGreaterThan(roots.length);
    expect(violations).toEqual([]);
  });

  it.each([
    ["import { cookies } from 'next/headers';", 'imports next/headers'],
    ["import { headers as h } from 'next/headers';", 'imports headers'],
    ["const { draftMode } = await import('next/headers');", 'imports next/headers'],
    ["export { cookies } from 'next/headers';", 'imports next/headers'],
    ["import { draftMode } from './elsewhere';", 'imports draftMode'],
  ])('detects %s', (text, expected) => {
    // Act
    const { violations } = scanSource('fixture.tsx', text);
    // Assert
    expect(violations.join('\n')).toContain(expected);
  });

  it('follows relative imports into modules outside the scanned folders', () => {
    // Act
    const { specifiers } = scanSource('fixture.ts', "import { x } from '../../src/lib/x';\nimport y from 'react';");
    // Assert
    expect(specifiers).toEqual(['../../src/lib/x', 'react']);
  });
});

const TENANT_PAGES = 'app/%5Ft/[locale]/[storeId]/[binding]';
/** The pages that must never read the query string: the home page and the product page. */
const QUERY_FREE_ROOTS = [`${TENANT_PAGES}/page.tsx`, `${TENANT_PAGES}/product/[slug]/page.tsx`].map((path) =>
  join(APP_ROOT, path),
);
const QUERY_API_NAME = 'searchParams';

/** Every use of the `searchParams` name (a prop, a binding, a property access) in one source text. */
function scanQueryReads(fileName: string, text: string): { violations: Violation[]; specifiers: string[] } {
  const { specifiers } = scanSource(fileName, text);
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === QUERY_API_NAME) violations.push(`${fileName}: reads ${QUERY_API_NAME}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { violations, specifiers };
}

describe('home and product renders read no query string (ADR 0006)', () => {
  it('finds no searchParams in the module graph of the home and product pages', () => {
    // Arrange
    expect(QUERY_FREE_ROOTS.every((root) => existsSync(root))).toBe(true);
    // Act
    const { violations, scanned } = scanModuleGraph(QUERY_FREE_ROOTS, scanQueryReads);
    // Assert
    expect(scanned.length).toBeGreaterThan(QUERY_FREE_ROOTS.length);
    expect(violations).toEqual([]);
  });

  it.each([
    'export default function Page({ searchParams }: Props) { return null; }',
    'const q = (await props.searchParams).q;',
    'const { searchParams } = new URL(url);',
  ])('detects %s', (text) => {
    expect(scanQueryReads('fixture.tsx', text).violations).toEqual(['fixture.tsx: reads searchParams']);
  });
});

/** Calls that read the theme name from the environment. */
const THEME_NAME_READERS: ReadonlySet<string> = new Set(['themeNameFor', 'storefrontThemeName']);

function hasUseCacheDirective(body: ts.Node | undefined): boolean {
  if (body === undefined || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  return (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === 'use cache'
  );
}

function calledName(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node)) return undefined;
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  return ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
}

/** Theme name reads inside `'use cache'` functions of one source text. */
function scanCachedThemeReads(fileName: string, text: string): { violations: Violation[]; specifiers: string[] } {
  const { specifiers } = scanSource(fileName, text);
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];
  const visit = (node: ts.Node, cached: boolean): void => {
    const inCache =
      cached || (ts.isFunctionLike(node) && hasUseCacheDirective((node as ts.FunctionLikeDeclaration).body));
    const name = calledName(node);
    if (inCache && name !== undefined && THEME_NAME_READERS.has(name)) {
      violations.push(`${fileName}: ${name} inside 'use cache'`);
    }
    ts.forEachChild(node, (child) => {
      visit(child, inCache);
    });
  };
  visit(source, false);
  return { violations, specifiers };
}

describe('cached renders take the theme name as an argument (D3207)', () => {
  it("finds no theme name read inside a 'use cache' function of the tenant module graph", () => {
    // Act
    const { violations } = scanModuleGraph(SCAN_ROOTS.flatMap(sourceFilesUnder), scanCachedThemeReads);
    // Assert
    expect(violations).toEqual([]);
  });

  it('detects a theme name read inside a cached function', () => {
    // Arrange
    const text = "async function Body() {\n  'use cache';\n  return themeSource.themeNameFor(store);\n}";
    // Act and Assert
    expect(scanCachedThemeReads('fixture.tsx', text).violations).toEqual([
      "fixture.tsx: themeNameFor inside 'use cache'",
    ]);
  });
});
