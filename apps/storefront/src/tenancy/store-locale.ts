import { isPlatformLanguageCode, PLATFORM_LANGUAGE_CODES, type PlatformLanguageCode } from '@cod/shared';

/** A store's language: one of the platform languages (ADR 0005). */
export type StoreLocale = PlatformLanguageCode;

/** A store was configured with a locale the platform does not support. */
export class InvalidStoreLocaleError extends Error {
  constructor(value: string) {
    super(`'${value}' is not a platform language (${PLATFORM_LANGUAGE_CODES.join(', ')})`);
    this.name = 'InvalidStoreLocaleError';
  }
}

/**
 * Checks a locale at runtime: store data comes from outside the type system.
 *
 * @throws InvalidStoreLocaleError when `value` is not in `PLATFORM_LANGUAGE_CODES`
 */
export function toStoreLocale(value: string): StoreLocale {
  if (!isPlatformLanguageCode(value)) throw new InvalidStoreLocaleError(value);
  return value;
}
