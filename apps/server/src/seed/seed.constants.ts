import { PLATFORM_CURRENCY_CODE, PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import { CurrencyCode, LanguageCode } from '@vendure/core';

/** The only country the platform sells to, ISO 3166-1 alpha-2. */
export const ALGERIA_COUNTRY_CODE = 'DZ';

/** Algeria's name in each platform language. */
export const ALGERIA_COUNTRY_NAMES: readonly { languageCode: LanguageCode; name: string }[] = [
  { languageCode: LanguageCode.ar, name: 'الجزائر' },
  { languageCode: LanguageCode.fr, name: 'Algérie' },
  { languageCode: LanguageCode.en, name: 'Algeria' },
];

/** The zone holding Algeria; the default channel taxes and ships by it. */
export const ALGERIA_ZONE_NAME = 'Algeria';

/** COD merchants sell without VAT handling for now, so every price carries a zero tax. */
export const ZERO_TAX_CATEGORY_NAME = 'Zero rate';

/** The zero tax rate of {@link ZERO_TAX_CATEGORY_NAME} in {@link ALGERIA_ZONE_NAME}. */
export const ZERO_TAX_RATE_NAME = 'Algeria zero rate';

/** The rate, in percent, of {@link ZERO_TAX_RATE_NAME}. */
export const ZERO_TAX_RATE_VALUE = 0;

/** Vendure's code for the channel it creates at first boot. */
export const DEFAULT_CHANNEL_CODE = '__default_channel__';

/** The platform currency as Vendure's enum. */
export const PLATFORM_CURRENCY = CurrencyCode[PLATFORM_CURRENCY_CODE];

/** The platform languages as Vendure's enum, in the platform's order. */
export const PLATFORM_LANGUAGES: readonly LanguageCode[] = PLATFORM_LANGUAGE_CODES.map((code) => LanguageCode[code]);

/** True when `actual` is exactly the platform languages, in order. */
export const hasPlatformLanguages = (actual: readonly LanguageCode[]): boolean =>
  actual.length === PLATFORM_LANGUAGES.length && actual.every((code, index) => code === PLATFORM_LANGUAGES[index]);

/** Prices are entered tax-inclusive: the price a merchant types is the price the buyer pays. */
export const PRICES_INCLUDE_TAX = true;

/** One `kind:name` entry of a seed report. */
export const seedChange = (kind: string, name: string): string => `${kind}:${name}`;
