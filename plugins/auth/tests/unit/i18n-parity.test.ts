import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AUTH_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';

const DASHBOARD_DIR = join(__dirname, '../../dashboard');
const REQUIRED_LOCALES = ['en', 'ar'] as const;
const SOURCE_FILE = /\.tsx?$/;
const MESSAGE_CALL = /(?:i18n\._\(|\btitle:)\s*(?:'([^']+)'|"([^"]+)")/g;
const MESSAGE_CONSTANT = /_(?:MESSAGE_ID|TITLE)\s*=\s*(?:'([^']+)'|"([^"]+)")/g;
const CATALOGUE_ID_LITERAL = /['"]((?:subdomain|auth)\.[a-z-]+)['"]/g;
const LAYER_IMPORT = /from\s+['"]([^'"]*\/(?:domain|application)(?:\/[^'"]*)?)['"]/g;

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
  return [...source.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? '');
}

function usedMessageIds(): string[] {
  const ids = sourceFiles(DASHBOARD_DIR).flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return [MESSAGE_CALL, MESSAGE_CONSTANT, CATALOGUE_ID_LITERAL].flatMap((pattern) => matches(source, pattern));
  });
  return [...new Set([...ids, ...Object.values(AUTH_ERROR_CODES)])];
}

describe('dashboard catalogues (D40)', () => {
  it('finds the messages of the auth pages', () => {
    expect(usedMessageIds().length).toBeGreaterThan(Object.values(AUTH_ERROR_CODES).length);
  });

  it.each(REQUIRED_LOCALES)('every id used in dashboard/ has a non-empty translation in %s', (locale) => {
    const catalogue = readCatalogue(locale);

    const missing = usedMessageIds().filter((id) => !catalogue.get(id));

    expect(missing).toEqual([]);
  });
});

describe('dashboard layering (ADR 0017)', () => {
  it('no file under dashboard/ imports a domain or application path', () => {
    const offenders = sourceFiles(DASHBOARD_DIR).flatMap((file) =>
      matches(readFileSync(file, 'utf8'), LAYER_IMPORT).map((path) => `${relative(DASHBOARD_DIR, file)}: ${path}`),
    );

    expect(offenders).toEqual([]);
  });
});
