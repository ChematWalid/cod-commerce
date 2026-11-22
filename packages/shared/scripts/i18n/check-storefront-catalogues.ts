/** The storefront catalogue languages; English is the reference for placeholders. */
type StorefrontCatalogueLocale = 'ar' | 'fr' | 'en';

/** The six CLDR plural categories every Arabic plural message must spell out (ADR 0005). */
const ARABIC_PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/** Every CLDR plural category a form may be named by. */
const PLURAL_CATEGORIES: readonly string[] = ARABIC_PLURAL_FORMS;

/** `count` is the plural selector: a form may spell the number out instead ("نتيجتان"). */
const SELECTOR_PLACEHOLDER = 'count';

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;

/**
 * A gap in the storefront catalogues: a key absent from one language (`missing`), a blank text (`empty`), a plural
 * without `other` or, in Arabic, without all six forms (`plural`), placeholders that differ from English
 * (`placeholder`), or a value that is neither a text nor plural forms (`invalid`).
 */
export interface StorefrontCatalogueProblem {
  readonly locale: StorefrontCatalogueLocale;
  readonly key: string;
  readonly kind: 'missing' | 'empty' | 'plural' | 'placeholder' | 'invalid';
}

type Catalogues = Readonly<Record<StorefrontCatalogueLocale, Readonly<Record<string, unknown>>>>;

type Forms = Readonly<Record<string, unknown>>;

function isForms(value: unknown): value is Forms {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textsOf(value: unknown): string[] | undefined {
  if (typeof value === 'string') return [value];
  if (!isForms(value)) return undefined;
  const entries = Object.entries(value);
  const valid = entries.every(([form, text]) => PLURAL_CATEGORIES.includes(form) && typeof text === 'string');
  return valid && entries.length > 0 ? entries.map(([, text]) => text as string) : undefined;
}

function placeholdersOf(texts: readonly string[], plural: boolean): string {
  const names = texts.flatMap((text) => [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? ''));
  return [...new Set(names.filter((name) => !plural || name !== SELECTOR_PLACEHOLDER))].sort().join(',');
}

function lacksPluralForms(locale: StorefrontCatalogueLocale, forms: Forms): boolean {
  const required = locale === 'ar' ? ARABIC_PLURAL_FORMS : (['other'] as const);
  return required.some((form) => forms[form] === undefined);
}

function entryProblem(
  locale: StorefrontCatalogueLocale,
  value: unknown,
  reference: unknown,
): StorefrontCatalogueProblem['kind'] | undefined {
  if (value === undefined) return 'missing';
  const texts = textsOf(value);
  if (texts === undefined) return 'invalid';
  if (texts.some((text) => text.trim() === '')) return 'empty';
  if (isForms(value) && lacksPluralForms(locale, value)) return 'plural';
  const referenceTexts = textsOf(reference);
  if (referenceTexts === undefined) return undefined;
  const plural = isForms(value);
  return placeholdersOf(texts, plural) === placeholdersOf(referenceTexts, plural) ? undefined : 'placeholder';
}

/**
 * Every gap in the storefront catalogues (D3212): each key used by any language must exist, filled, in all three,
 * with the placeholders of the English text.
 */
export function checkStorefrontCatalogues(catalogues: Catalogues): StorefrontCatalogueProblem[] {
  const locales = Object.keys(catalogues) as StorefrontCatalogueLocale[];
  const keys = [...new Set(locales.flatMap((locale) => Object.keys(catalogues[locale])))].sort();
  return locales.flatMap((locale) =>
    keys.flatMap((key) => {
      const kind = entryProblem(locale, catalogues[locale][key], catalogues.en[key]);
      return kind === undefined ? [] : [{ locale, key, kind }];
    }),
  );
}
