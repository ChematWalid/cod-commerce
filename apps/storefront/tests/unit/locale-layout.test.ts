import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { generateStaticParams } from '../../app/%5Ft/[locale]/layout';
import { LocaleRoot } from '../../src/i18n/locale-root';

function documentOf(locale: string): string {
  return renderToStaticMarkup(LocaleRoot({ locale, children: createElement('p', null, 'page') }));
}

describe('tenant locale layout', () => {
  it('renders an Arabic store right to left in Arabic', () => {
    expect(documentOf('ar')).toMatch(/^<div lang="ar" dir="rtl"/);
  });

  it('renders a French store left to right in French', () => {
    expect(documentOf('fr')).toMatch(/^<div lang="fr" dir="ltr"/);
  });

  it('renders an English store left to right', () => {
    expect(documentOf('en')).toMatch(/^<div lang="en" dir="ltr"/);
  });

  it('falls back to the platform language for a locale that is not a platform language', () => {
    expect(documentOf('de')).toMatch(/^<div lang="ar" dir="rtl"/);
  });

  it('prerenders one shell per platform language', () => {
    expect(generateStaticParams()).toEqual([{ locale: 'ar' }, { locale: 'fr' }, { locale: 'en' }]);
  });
});
