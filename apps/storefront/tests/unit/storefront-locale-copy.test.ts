import { PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCUMENT_LOCALE, documentDirection, NOT_FOUND_MESSAGES } from '../../src/i18n/storefront-locale-copy';

describe('storefront locale copy', () => {
  it('writes Arabic right to left and the other languages left to right', () => {
    expect(documentDirection('ar')).toBe('rtl');
    expect(documentDirection('fr')).toBe('ltr');
    expect(documentDirection('en')).toBe('ltr');
  });

  it('has a not-found message in every platform language', () => {
    for (const locale of PLATFORM_LANGUAGE_CODES) expect(NOT_FOUND_MESSAGES[locale]).toBeTruthy();
  });

  it('uses Arabic, the primary platform language, before a store applies', () => {
    expect(DEFAULT_DOCUMENT_LOCALE).toBe('ar');
  });
});
