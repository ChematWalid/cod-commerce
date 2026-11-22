import type { PlatformLanguageCode } from '../../platform/platform-defaults';
import ar from './ar.json';
import en from './en.json';
import fr from './fr.json';

/** A storefront language: the store's language decides it, never the buyer's browser (ADR 0005). */
export type StorefrontLocale = PlatformLanguageCode;

/** A message with one text per CLDR plural category; `other` is the fallback for a missing category. */
export type PluralMessage = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & { readonly other: string };

/** One catalogue entry: a plain text or plural forms. Placeholders are written `{name}`. */
export type StorefrontMessage = string | PluralMessage;

/** Every storefront message key; English is the reference catalogue. */
export type StorefrontMessageKey = keyof typeof en;

/** One language's storefront catalogue. */
export type StorefrontMessages = Readonly<Record<StorefrontMessageKey, StorefrontMessage>>;

/** Values a message's placeholders take; `count` also picks the plural form. */
export type MessageParams = Readonly<Record<string, string | number>>;

/**
 * The raw ar/fr/en catalogues (D3212). `pnpm i18n:check` proves they hold the same keys, no empty text and all six
 * Arabic plural forms, which is why they can be read as {@link StorefrontMessages}.
 */
export const STOREFRONT_CATALOGUES: Readonly<Record<StorefrontLocale, Readonly<Record<string, unknown>>>> = {
  ar,
  fr,
  en,
};

/** The BCP 47 tag numbers and plurals are formatted with, per store language. */
const INTL_LOCALES: Readonly<Record<StorefrontLocale, string>> = { ar: 'ar-DZ', fr: 'fr-DZ', en: 'en' };

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

/** The catalogue of `locale`. */
export function storefrontMessages(locale: StorefrontLocale): StorefrontMessages {
  return STOREFRONT_CATALOGUES[locale] as StorefrontMessages;
}

/** A number with Latin digits and the language's grouping, as amounts are written in Algeria. */
export function formatNumber(locale: StorefrontLocale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], { numberingSystem: 'latn', maximumFractionDigits: 0 }).format(
    value,
  );
}

function pluralText(locale: StorefrontLocale, message: PluralMessage, count: unknown): string {
  if (typeof count !== 'number') return message.other;
  const category = new Intl.PluralRules(INTL_LOCALES[locale]).select(count);
  return message[category] ?? message.other;
}

function fillPlaceholders(locale: StorefrontLocale, text: string, params: MessageParams): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    return typeof value === 'number' ? formatNumber(locale, value) : value;
  });
}

/**
 * The text of `key` in `locale`, with the plural form picked by `params.count` (`Intl.PluralRules`, so Arabic gets
 * zero/one/two/few/many/other) and `{name}` placeholders filled. A missing parameter stays visible as `{name}`.
 */
export function formatMessage(locale: StorefrontLocale, key: StorefrontMessageKey, params: MessageParams = {}): string {
  const message = storefrontMessages(locale)[key];
  const text = typeof message === 'string' ? message : pluralText(locale, message, params['count']);
  return fillPlaceholders(locale, text, params);
}

/** A whole-DZD amount as the store's language writes it: `12 500 DA`, `12,500 DA`, `12.500 د.ج`. */
export function formatDzd(locale: StorefrontLocale, amount: number): string {
  return formatMessage(locale, 'money.dzd', { amount: formatNumber(locale, amount) });
}
