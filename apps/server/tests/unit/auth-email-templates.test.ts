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
    inviter: 'Karim',
    business: 'Atlas Shop',
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
    const email = authEmailTemplates.render(kind, locale, {
      ...varsFor(kind),
      name: SCRIPT_NAME,
      inviter: SCRIPT_NAME,
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.subject).not.toContain('<');
  });

  it('isolates the Latin name and address inside Arabic text, in html and text', () => {
    const vars = { ...varsFor('email-change-confirm'), name: 'Sara', newEmail: 'new@example.test' };

    const email = authEmailTemplates.render('email-change-confirm', 'ar', vars);

    for (const body of [email.html, email.text]) {
      expect(body).toContain('\u2068Sara\u2069');
      expect(body).toContain('\u2068new@example.test\u2069');
    }
  });

  it('adds no isolates to English copy', () => {
    const email = authEmailTemplates.render('password-changed', 'en', varsFor('password-changed'));

    expect(email.text).not.toMatch(/[\u2068\u2069]/);
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

describe('team invitation email', () => {
  const INVITE_LINK = 'https://dash.example.test/dashboard/accept-invitation?token=abc_DEF-123';
  const VARS = { inviter: 'Karim', business: 'Atlas Shop', link: INVITE_LINK };

  it.each(AUTH_EMAIL_LOCALES)('names the business in the subject and links the invitation in %s', (locale) => {
    // Act
    const email = authEmailTemplates.render('team-invitation', locale, VARS);

    // Assert
    expect(email.subject).toContain('Atlas Shop');
    expect(email.html).toContain('Karim');
    expect(email.text).toContain(INVITE_LINK);
    expect(email.html).toContain(`href="${INVITE_LINK}"`);
  });

  it('states the seven-day lifetime of the link in both languages', () => {
    const arabic = authEmailTemplates.render('team-invitation', 'ar', VARS);
    const english = authEmailTemplates.render('team-invitation', 'en', VARS);

    expect(english.text).toContain('7 days');
    expect(arabic.text).toContain('7 أيام');
  });

  it.each(AUTH_EMAIL_LOCALES)('shows no third-party product name in %s', (locale) => {
    const email = authEmailTemplates.render('team-invitation', locale, VARS);

    for (const body of [email.subject, email.html, email.text]) {
      expect(body).not.toMatch(/vendure/i);
    }
  });

  it('isolates the Latin inviter and business names inside Arabic text', () => {
    const email = authEmailTemplates.render('team-invitation', 'ar', VARS);

    expect(email.text).toContain('\u2068Karim\u2069');
    expect(email.text).toContain('\u2068Atlas Shop\u2069');
  });

  it('keeps a business name with a line break on one subject line', () => {
    const email = authEmailTemplates.render('team-invitation', 'en', { ...VARS, business: 'Atlas\r\nBcc: x@y.test' });

    expect(email.subject).not.toMatch(/[\r\n]/);
  });

  it('refuses a link that is not http or https', () => {
    expect(() =>
      authEmailTemplates.render('team-invitation', 'en', { ...VARS, link: 'javascript:alert(1)' }),
    ).toThrow();
  });

  it('keeps a lifetime of a single day in hours, as the older emails say it', () => {
    const email = authEmailTemplates.render('verification', 'en', varsFor('verification'));

    expect(email.text).toContain('24 hours');
  });
});
