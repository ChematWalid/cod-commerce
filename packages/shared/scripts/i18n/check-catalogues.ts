import { parsePoCatalogue } from './po-catalogue';
import { scanMessageIds, type DashboardSource } from './scan-message-ids';

export type { DashboardSource } from './scan-message-ids';

/** The dashboard catalogues a plugin may hold. */
export type CatalogueLocale = 'en' | 'ar' | 'fr';

/** One plugin dashboard as the check reads it: its sources, its raw `.po` texts and its registry. */
export interface PluginCatalogueInput {
  readonly plugin: string;
  readonly sources: readonly DashboardSource[];
  readonly catalogues: Readonly<Partial<Record<CatalogueLocale, string>>>;
  /** Ids built at run time, such as server error codes (`dashboard/i18n/dynamic-ids.ts`). */
  readonly dynamicIds?: readonly string[];
  /** Dotted literals of the dashboard that are not catalogue ids, such as nav leaf ids and server codes. */
  readonly nonMessageLiterals?: readonly string[];
}

/** A gap: an id with no translation in a required catalogue, or an Arabic plural lacking a category. */
export interface CatalogueProblem {
  readonly plugin: string;
  readonly locale: CatalogueLocale;
  readonly id: string;
  readonly kind: 'missing' | 'empty' | 'plural';
}

/** The plugin whose catalogues every dashboard can use: the Vite plugin merges them, and `SubdomainField` lives there. */
export const SHELL_PLUGIN = 'merchant-shell';

/** Every dashboard id needs English and Arabic (ADR 0005). */
const REQUIRED_LOCALES: readonly CatalogueLocale[] = ['en', 'ar'];

/** The subdomain messages are also shown in French (D40). */
const FRENCH_ID_PREFIX = 'subdomain.';

/** The CLDR plural categories of Arabic: an Arabic plural message names all six (ADR 0005). */
const ARABIC_PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

const PLURAL_MARKER = /\bplural\s*,/;

type Catalogues = Readonly<Partial<Record<CatalogueLocale, ReadonlyMap<string, string>>>>;

function parseAll(input: PluginCatalogueInput): Catalogues {
  const parsed: Partial<Record<CatalogueLocale, ReadonlyMap<string, string>>> = {};
  for (const [locale, text] of Object.entries(input.catalogues) as [CatalogueLocale, string | undefined][]) {
    if (text !== undefined) parsed[locale] = parsePoCatalogue(text);
  }
  return parsed;
}

/**
 * The ids a plugin dashboard uses: scanned from its sources, then its registered dynamic ids, without repeats.
 * `sharedNonMessageLiterals` are the shell's, which hold for every dashboard (its leaf ids reach `registerShellPage`).
 */
export function usedMessageIds(
  input: PluginCatalogueInput,
  sharedNonMessageLiterals: readonly string[] = [],
): string[] {
  const skipped = new Set([...sharedNonMessageLiterals, ...(input.nonMessageLiterals ?? [])]);
  const scanned = input.sources.flatMap((source) => scanMessageIds(source, skipped));
  return [...new Set([...scanned, ...(input.dynamicIds ?? [])])];
}

const localesFor = (id: string): readonly CatalogueLocale[] =>
  id.startsWith(FRENCH_ID_PREFIX) ? [...REQUIRED_LOCALES, 'fr'] : REQUIRED_LOCALES;

function gapOf(
  id: string,
  locale: CatalogueLocale,
  own: Catalogues,
  shell: Catalogues,
): CatalogueProblem['kind'] | null {
  const candidates = [own[locale]?.get(id), shell[locale]?.get(id)];
  if (candidates.some((text) => text !== undefined && text !== '')) return null;
  return candidates.some((text) => text !== undefined) ? 'empty' : 'missing';
}

function pluralProblems(plugin: string, arabic: ReadonlyMap<string, string> | undefined): CatalogueProblem[] {
  return [...(arabic ?? new Map<string, string>())]
    .filter(([, text]) => PLURAL_MARKER.test(text))
    .filter(([, text]) => ARABIC_PLURAL_CATEGORIES.some((category) => !new RegExp(`\\b${category}\\s*\\{`).test(text)))
    .map(([id]) => ({ plugin, locale: 'ar', id, kind: 'plural' }));
}

/**
 * Checks every plugin dashboard against its catalogues (D89). Each used id needs a non-empty translation in English
 * and Arabic, in the plugin's own catalogue or the shell's; a `subdomain.*` id needs French too; an Arabic message
 * with `plural,` names the six Arabic categories. Pure: the caller reads the files.
 */
export function checkCatalogues(input: {
  readonly plugins: readonly PluginCatalogueInput[];
}): readonly CatalogueProblem[] {
  const shellInput = input.plugins.find((entry) => entry.plugin === SHELL_PLUGIN);
  const shell = shellInput ? parseAll(shellInput) : {};
  return input.plugins.flatMap((plugin) => {
    const own = parseAll(plugin);
    const gaps = usedMessageIds(plugin, shellInput?.nonMessageLiterals).flatMap((id) =>
      localesFor(id).flatMap((locale) => {
        const kind = gapOf(id, locale, own, shell);
        return kind === null ? [] : [{ plugin: plugin.plugin, locale, id, kind }];
      }),
    );
    return [...gaps, ...pluralProblems(plugin.plugin, own.ar)];
  });
}

/** One line of the command's output: `<plugin> <locale> <kind> <id>`. */
export function formatProblem(problem: CatalogueProblem): string {
  return `${problem.plugin} ${problem.locale} ${problem.kind} ${problem.id}`;
}
