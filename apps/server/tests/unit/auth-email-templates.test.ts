import { AUTH_EMAIL_KINDS, AUTH_EMAIL_LOCALES, AUTH_EMAIL_REQUIRED_VARS, type AuthEmailKind } from '@cod/plugin-auth';
import { describe, expect, it } from 'vitest';
import { authEmailTemplates } from '../../src/email';

const LINK = 'https://dash.example.test/dashboard/verify-email?token=abc_DEF-123';
const CODE = '482913';
const SCRIPT_NAME = '<script>alert("x")</script>';

function varsFor(kind: AuthEmailKind): Record<string, string> {
  const values: Record<string, string> = {
    name: 'Sara',
    link: LINK,
    code: CODE,
    newEmail: 'new@example.test',
  };
  return Object.fromEntries(AUTH_EMAIL_REQUIRED_VARS[kind].map((name) => [name, values[name] ?? 'x']));
}

const CASES = AUTH_EMAIL_KINDS.flatMap((kind) => AUTH_EMAIL_LOCALES.map((locale) => ({ kind, locale })));

describe('auth email templates', () => {
  it.each(CASES)('renders a subject, html and text for $kind in $locale', ({ kind, locale }) => {
    // Act
    const email = authEmailTemplates.render(kind, locale, varsFor(kind));

    // Assert
    expect(email.subject.trim()).not.toBe('');
    expect(email.html.trim()).not.toBe('');
    expect(email.text.trim()).not.toBe('');
    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it.each(CASES)('puts the link and code of $kind in $locale in both bodies', ({ kind, locale }) => {
    const vars = varsFor(kind);
    const email = authEmailTemplates.render(kind, locale, vars);

    for (const name of ['link', 'code'] as const) {
      if (name in vars) {
        expect(email.text).toContain(vars[name]);
        expect(email.html).toContain(vars[name]);
      }
    }
  });

  it('gives Arabic bodies dir="rtl" and lang="ar", and English ltr', () => {
    const vars = varsFor('verification');

    const arabic = authEmailTemplates.render('verification', 'ar', vars);
    const english = authEmailTemplates.render('verification', 'en', vars);

    expect(arabic.html).toContain('dir="rtl"');
    expect(arabic.html).toContain('lang="ar"');
    expect(english.html).toContain('dir="ltr"');
    expect(english.html).not.toContain('dir="rtl"');
  });

  it('renders Arabic copy in Arabic script and English copy without it', () => {
    const arabic = authEmailTemplates.render('password-reset', 'ar', varsFor('password-reset'));
    const english = authEmailTemplates.render('password-reset', 'en', varsFor('password-reset'));

    expect(arabic.subject).toMatch(/\p{Script=Arabic}/u);
    expect(english.subject).not.toMatch(/\p{Script=Arabic}/u);
  });

  it.each(CASES)('escapes a hostile name in $kind in $locale', ({ kind, locale }) => {
    const email = authEmailTemplates.render(kind, locale, { ...varsFor(kind), name: SCRIPT_NAME });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.subject).not.toContain('<');
  });

  it('escapes a hostile link inside its attribute', () => {
    const hostile = 'https://x.test/?a="><script>alert(1)</script>';

    const email = authEmailTemplates.render('password-reset', 'en', { ...varsFor('password-reset'), link: hostile });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('href="https://x.test/?a=&quot;&gt;&lt;script&gt;');
  });

  it('refuses a link that is not http or https', () => {
    expect(() =>
      authEmailTemplates.render('password-reset', 'en', { ...varsFor('password-reset'), link: 'javascript:alert(1)' }),
    ).toThrow();
  });

  it('throws on a missing variable instead of sending a broken mail', () => {
    expect(() => authEmailTemplates.render('verification', 'en', { name: 'Sara' })).toThrow();
  });
});
