/** Decimal places of money amounts: prices are whole dinars (ADR 0004). */
export const MONEY_PRECISION = 0;

/** The platform currency, ISO 4217. */
export const PLATFORM_CURRENCY_CODE = 'DZD';

/** Languages the platform supports (ADR 0005). */
export const PLATFORM_LANGUAGE_CODES = ['ar', 'fr', 'en'] as const;

/** One of the {@link PLATFORM_LANGUAGE_CODES}. */
export type PlatformLanguageCode = (typeof PLATFORM_LANGUAGE_CODES)[number];

/** Narrows a string to a {@link PlatformLanguageCode}. */
export function isPlatformLanguageCode(value: string): value is PlatformLanguageCode {
  return (PLATFORM_LANGUAGE_CODES as readonly string[]).includes(value);
}
