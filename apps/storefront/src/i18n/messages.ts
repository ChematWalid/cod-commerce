import {
  formatMessage,
  type MessageParams,
  STOREFRONT_CATALOGUES,
  type StorefrontLocale,
  type StorefrontMessageKey,
} from '@cod/shared';

/** The English catalogue is the reference: every key in it exists in every language (`pnpm i18n:check`). */
const REFERENCE_CATALOGUE = STOREFRONT_CATALOGUES.en;

/** Whether `key` names a storefront message, for keys that come from theme data rather than code. */
export function isMessageKey(key: unknown): key is StorefrontMessageKey {
  return typeof key === 'string' && Object.hasOwn(REFERENCE_CATALOGUE, key);
}

/** The text of `key` in the store's language (ADR 0005: the store decides, never the buyer's browser). */
export function t(locale: StorefrontLocale, key: StorefrontMessageKey, params?: MessageParams): string {
  return formatMessage(locale, key, params);
}

/** The text of a key read from theme settings, or of `fallback` when the setting is not a known key. */
export function tFromSetting(
  locale: StorefrontLocale,
  setting: unknown,
  fallback: StorefrontMessageKey,
  params?: MessageParams,
): string {
  return t(locale, isMessageKey(setting) ? setting : fallback, params);
}
