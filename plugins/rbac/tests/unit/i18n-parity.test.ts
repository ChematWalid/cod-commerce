import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ACTIVITY_ACTIONS, RBAC_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';

const DASHBOARD_DIR = join(__dirname, '../../dashboard');
const REQUIRED_LOCALES = ['en', 'ar'] as const;
const SOURCE_FILE = /\.tsx?$/;
const CATALOGUE_ID_LITERAL = /['"](rbac\.[a-z.-]+)['"]/g;
const FORBIDDEN_LAYER_IMPORT = /from\s+['"]([^'"]*\/(?:domain|application|infrastructure|api)(?:\/[^'"]*)?)['"]/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SOURCE_FILE.test(name) ? [path] : [];
  });
}

/** Reads a catalogue as id to translation, unescaping only what `.po` escapes. */
function readCatalogue(locale: string): ReadonlyMap<string, string> {
  const text = readFileSync(join(DASHBOARD_DIR, 'i18n', `${locale}.po`), 'utf8');
  const entries = text.matchAll(/^msgid "((?:[^"\\]|\\.)*)"\nmsgstr "((?:[^"\\]|\\.)*)"$/gm);
  return new Map([...entries].map(([, id, translation]) => [id ?? '', translation ?? '']));
}

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

function usedMessageIds(): string[] {
  const ids = sourceFiles(DASHBOARD_DIR).flatMap((file) => matches(readFileSync(file, 'utf8'), CATALOGUE_ID_LITERAL));
  return [...new Set([...ids, ...Object.values(RBAC_ERROR_CODES), ...Object.values(ACTIVITY_ACTIONS)])];
}

describe('dashboard catalogues (D40, D72)', () => {
  it('finds the messages of the roles pages', () => {
    const codes = Object.values(RBAC_ERROR_CODES).length + Object.values(ACTIVITY_ACTIONS).length;

    expect(usedMessageIds().length).toBeGreaterThan(codes);
  });

  it.each(REQUIRED_LOCALES)('every id used in dashboard/ has a non-empty translation in %s', (locale) => {
    const catalogue = readCatalogue(locale);

    const missing = usedMessageIds().filter((id) => !catalogue.get(id));

    expect(missing).toEqual([]);
  });

  it('every error code has its own message', () => {
    const catalogue = readCatalogue('en');

    const missing = Object.values(RBAC_ERROR_CODES).filter((code) => !catalogue.get(code));

    expect(missing).toEqual([]);
  });
});

describe('dashboard layering (ADR 0017)', () => {
  it('no file under dashboard/ imports a domain, application, infrastructure or api path', () => {
    const offenders = sourceFiles(DASHBOARD_DIR).flatMap((file) =>
      matches(readFileSync(file, 'utf8'), FORBIDDEN_LAYER_IMPORT).map(
        (path) => `${relative(DASHBOARD_DIR, file)}: ${path}`,
      ),
    );

    expect(offenders).toEqual([]);
  });
});
