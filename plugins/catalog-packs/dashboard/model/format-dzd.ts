/** Whole DZD with the display language's grouping and Latin digits, as amounts are written in Algeria. */
export function formatDzd(amount: number, language: string): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-DZ' : 'en', { numberingSystem: 'latn' }).format(amount);
}
