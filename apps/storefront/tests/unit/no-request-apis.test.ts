import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * ADR 0006: a tenant render is cached per store, so it must never read the request. This scans, with the TypeScript
 * AST, every module under `app/%5Ft/**`, `src/theme` and `src/store` and every module they import (relative imports,
 * followed transitively), and fails on any use of `cookies`, `headers` or `draftMode`.
 */

const APP_ROOT = resolve(__dirname, '../..');
const SCAN_ROOTS = ['app/%5Ft', 'src/theme', 'src/store'].map((path) => join(APP_ROOT, path));
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

function scanModuleGraph(roots: readonly string[]): { violations: Violation[]; scanned: string[] } {
  const pending = [...roots];
  const seen = new Set<string>();
  const violations: Violation[] = [];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    const result = scanSource(relative(APP_ROOT, file), readFileSync(file, 'utf8'));
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
