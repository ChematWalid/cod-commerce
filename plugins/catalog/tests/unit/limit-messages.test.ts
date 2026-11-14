import {
  CATALOG_ERROR_CODES,
  MAX_OPTION_GROUPS,
  MAX_OPTION_VALUES,
  MAX_PRODUCT_HIGHLIGHTS,
  MAX_TAXONOMY_ENTRIES_PER_STORE,
  MAX_VARIANTS,
  MEDIA_MAX_BYTES,
} from '@cod/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { messageKeyOf } from '../../api/error-mapping';

const LOCALES = ['en', 'ar'] as const;
type Locale = (typeof LOCALES)[number];
const BYTES_PER_MB = 1024 * 1024;
const C = CATALOG_ERROR_CODES;

/** Each refusal that quotes a cap, and the caps it must quote: a raised constant must not leave the old number. */
const LIMITS_OF_CODE: readonly (readonly [string, readonly number[]])[] = [
  [C.TOO_MANY_HIGHLIGHTS, [MAX_PRODUCT_HIGHLIGHTS]],
  [C.MATRIX_TOO_LARGE, [MAX_OPTION_GROUPS, MAX_OPTION_VALUES, MAX_VARIANTS]],
  [C.MEDIA_TOO_LARGE, [MEDIA_MAX_BYTES / BYTES_PER_MB]],
  [C.TAXONOMY_LIMIT, [MAX_TAXONOMY_ENTRIES_PER_STORE]],
];

/** The API message of `code` in `locale` (`api/i18n/<locale>.json`). */
function apiMessage(locale: Locale, code: string): string {
  const text = readFileSync(join(__dirname, `../../api/i18n/${locale}.json`), 'utf8');
  const { error } = JSON.parse(text) as { error: Record<string, string> };
  return error[messageKeyOf(code).replace(/^error\./, '')] ?? '';
}

/** The dashboard message of `code` in `locale` (`dashboard/i18n/<locale>.po`, single-line entries). */
function dashboardMessage(locale: Locale, code: string): string {
  const text = readFileSync(join(__dirname, `../../dashboard/i18n/${locale}.po`), 'utf8');
  for (const match of text.matchAll(/^msgid "(.*)"\nmsgstr "(.*)"$/gm)) if (match[1] === code) return match[2] ?? '';
  return '';
}

/** Whether `message` holds `limit` as a whole number, not as part of a longer one. */
const quotes = (message: string, limit: number): boolean => new RegExp(`(?<!\\d)${String(limit)}(?!\\d)`).test(message);

const cases = LOCALES.flatMap((locale) =>
  LIMITS_OF_CODE.flatMap(([code, limits]) => [
    { surface: 'api', locale, code, limits, message: apiMessage(locale, code) },
    { surface: 'dashboard', locale, code, limits, message: dashboardMessage(locale, code) },
  ]),
);

describe('refusal messages that quote a cap', () => {
  it.each(cases)('$surface $locale $code quotes the current cap', ({ message, limits }) => {
    // Arrange
    const expected = limits.map(String);

    // Act
    const quoted = limits.filter((limit) => quotes(message, limit)).map(String);

    // Assert
    expect(message).not.toBe('');
    expect(quoted).toEqual(expected);
  });
});
