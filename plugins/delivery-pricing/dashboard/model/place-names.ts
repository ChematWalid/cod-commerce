import { type Town, WILAYAS, type WilayaCode } from '@cod/shared';

/** Whether the display locale is Arabic, which shows the Arabic names of places. */
const isArabic = (locale: string): boolean => locale.split(/[-_]/)[0] === 'ar';

/** A wilaya's name in the UI language: Arabic in Arabic, else the French (Latin) name; its code when unnamed. */
export function wilayaNameOf(code: WilayaCode, locale: string): string {
  const names = WILAYAS.find((wilaya) => wilaya.code === code)?.names ?? null;
  if (names === null) return code;
  return isArabic(locale) ? names.ar : names.fr;
}

/** A commune's name in the UI language: Arabic in Arabic, else its Latin name. */
export const townNameOf = (town: Pick<Town, 'name' | 'arabicName'>, locale: string): string =>
  isArabic(locale) ? town.arabicName : town.name;
