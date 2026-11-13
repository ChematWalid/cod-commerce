import type { AuthEmailLocale, AuthEmailVars, RenderedEmail } from '@cod/plugin-auth';
import { PRODUCT_NAME } from '@cod/shared';

/** What a kind says in one language; {@link renderMessage} turns it into html and text. */
export interface MessageSpec {
  readonly subject: string;
  readonly greeting: string;
  readonly paragraphs: readonly string[];
  readonly action?: { readonly label: string; readonly url: string };
  readonly code?: { readonly label: string; readonly value: string };
  readonly footnote: string;
}

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for an HTML body or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

/**
 * Returns `value` if it is an http(s) URL.
 *
 * @throws Error otherwise: a `javascript:` link must never reach an href.
 */
export function requireHttpUrl(value: string): string {
  const protocol = URL.canParse(value) ? new URL(value).protocol : '';
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error('email link must be an http(s) URL');
  }
  return value;
}

const FIRST_STRONG_ISOLATE = '\u2068';
const POP_DIRECTIONAL_ISOLATE = '\u2069';

/**
 * Keeps a Latin name or address from reordering the Arabic text around it (and the other way round): the bidi
 * algorithm treats the wrapped value as one unit. It works in html and in plain text.
 */
export function isolate(value: string): string {
  return `${FIRST_STRONG_ISOLATE}${value}${POP_DIRECTIONAL_ISOLATE}`;
}

/** The variable `name` of an email's variables. @throws Error if it is missing or empty. */
export function requireVar(vars: AuthEmailVars, name: string): string {
  const value = vars[name];
  if (value === undefined || value === '') {
    throw new Error(`email variable "${name}" is missing`);
  }
  return value;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const ARABIC_FEW_MAX = 10;

type Unit = 'minute' | 'hour' | 'day';

const ARABIC_UNITS: Readonly<Record<Unit, { one: string; two: string; few: string; many: string }>> = {
  minute: { one: 'دقيقة واحدة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' },
  hour: { one: 'ساعة واحدة', two: 'ساعتان', few: 'ساعات', many: 'ساعة' },
  day: { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يومًا' },
};

function inUnit(locale: AuthEmailLocale, count: number, unit: Unit): string {
  if (locale === 'en') {
    return `${String(count)} ${unit}${count === 1 ? '' : 's'}`;
  }
  const words = ARABIC_UNITS[unit];
  if (count === 1) {
    return words.one;
  }
  if (count === 2) {
    return words.two;
  }
  return `${String(count)} ${count <= ARABIC_FEW_MAX ? words.few : words.many}`;
}

/**
 * A lifetime in words ("10 minutes", "24 hours", "7 days"), computed from the shared constants so copy never drifts
 * from them. Days start above one day, so the 24-hour links keep the wording their emails always had.
 */
export function describeDuration(locale: AuthEmailLocale, ms: number): string {
  if (ms > DAY_MS && ms % DAY_MS === 0) {
    return inUnit(locale, ms / DAY_MS, 'day');
  }
  return ms % HOUR_MS === 0
    ? inUnit(locale, ms / HOUR_MS, 'hour')
    : inUnit(locale, Math.round(ms / MINUTE_MS), 'minute');
}

const BODY_STYLE = 'margin:0;padding:24px;background:#f4f5f7;font-family:Tahoma,Arial,sans-serif;color:#1f2933;';
const CARD_STYLE = 'max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;';
const BUTTON_STYLE =
  'display:inline-block;padding:12px 24px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;';
const CODE_STYLE = 'font-size:28px;letter-spacing:6px;font-weight:bold;font-family:Consolas,monospace;';
const FOOTNOTE_STYLE = 'font-size:13px;color:#52606d;';

function htmlBody(spec: MessageSpec): string {
  const paragraphs = spec.paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
  const action =
    spec.action === undefined
      ? ''
      : `<p><a href="${escapeHtml(spec.action.url)}" style="${BUTTON_STYLE}">${escapeHtml(spec.action.label)}</a></p>` +
        `<p style="${FOOTNOTE_STYLE}">${escapeHtml(spec.action.url)}</p>`;
  const code =
    spec.code === undefined
      ? ''
      : `<p>${escapeHtml(spec.code.label)}</p><p><bdi dir="ltr" style="${CODE_STYLE}">${escapeHtml(spec.code.value)}</bdi></p>`;
  return `<p>${escapeHtml(spec.greeting)}</p>${paragraphs}${action}${code}<p style="${FOOTNOTE_STYLE}">${escapeHtml(spec.footnote)}</p>`;
}

function textBody(spec: MessageSpec): string {
  const lines = [spec.greeting, '', ...spec.paragraphs.flatMap((text) => [text, ''])];
  if (spec.action !== undefined) {
    lines.push(`${spec.action.label}:`, spec.action.url, '');
  }
  if (spec.code !== undefined) {
    lines.push(spec.code.label, spec.code.value, '');
  }
  lines.push(spec.footnote, '', PRODUCT_NAME);
  return lines.join('\n');
}

/** Wraps a message in the shared layout: Arabic is right-to-left. Every value is escaped. */
export function renderMessage(locale: AuthEmailLocale, spec: MessageSpec): RenderedEmail {
  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  const html =
    `<!doctype html><html lang="${locale}" dir="${direction}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(spec.subject)}</title></head>` +
    `<body dir="${direction}" style="${BODY_STYLE}"><div style="${CARD_STYLE}">` +
    `<p style="font-size:20px;font-weight:bold;">${escapeHtml(PRODUCT_NAME)}</p>${htmlBody(spec)}</div></body></html>`;
  return { subject: spec.subject, html, text: textBody(spec) };
}
