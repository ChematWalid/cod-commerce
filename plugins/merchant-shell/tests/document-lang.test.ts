import { describe, expect, it } from 'vitest';
import { toDocumentLang } from '../domain/document-lang';

describe('toDocumentLang', () => {
  it('maps the Arabic display locale to ar', () => {
    expect(toDocumentLang('ar')).toBe('ar');
  });

  it('maps a regional Arabic tag to ar', () => {
    expect(toDocumentLang('ar-DZ')).toBe('ar');
  });

  it('maps English to en', () => {
    expect(toDocumentLang('en')).toBe('en');
  });

  it('maps French and its regional tags to fr', () => {
    expect(toDocumentLang('fr')).toBe('fr');
    expect(toDocumentLang('fr-FR')).toBe('fr');
  });

  it('falls back to en for a locale the dashboard does not offer', () => {
    expect(toDocumentLang('de')).toBe('en');
  });
});
