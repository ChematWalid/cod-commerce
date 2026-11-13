import {
  flattensEnglishPlural,
  lacksArabicPluralForms,
  placeholdersDiffer,
  type ParsedCatalogue,
} from './entry-checks';
import { parsePoCatalogue, type PoEntry } from './po-catalogue';
import {
  scanDashboardSource,
  type DashboardSource,
  type ScannedMessages,
  type TemplateMessageId,
} from './scan-message-ids';

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

/**
 * A gap: an id with no translation in a required catalogue (`missing`, or `empty` when blank), an Arabic plural
 * lacking a form or category (`plural`), an unreviewed `#, fuzzy` entry (`fuzzy`), a translation whose placeholders
 * differ from the English text (`placeholder`), a template-literal id that no registered dynamic id matches
 * (`dynamic`, reported against `en`, the source catalogue), or a declared non-message literal (`literal`) that the
 * plugin's own catalogue holds as a message id, which the scan would then skip.
 */
export interface CatalogueProblem {
  readonly plugin: string;
  readonly locale: CatalogueLocale;
  readonly id: string;
  readonly kind: 'missing' | 'empty' | 'plural' | 'fuzzy' | 'placeholder' | 'dynamic' | 'literal';
}

/** The plugin whose catalogues every dashboard can use: the Vite plugin merges them, and `SubdomainField` lives there. */
export const SHELL_PLUGIN = 'merchant-shell';

/** Every dashboard id needs English and Arabic (ADR 0005). */
const REQUIRED_LOCALES: readonly CatalogueLocale[] = ['en', 'ar'];

/** The subdomain messages are also shown in French (D40). */
const FRENCH_ID_PREFIX = 'subdomain.';

type Catalogues = Readonly<Partial<Record<CatalogueLocale, ParsedCatalogue>>>;

function parseAll(input: PluginCatalogueInput): Catalogues {
  const parsed: Partial<Record<CatalogueLocale, ParsedCatalogue>> = {};
  for (const [locale, text] of Object.entries(input.catalogues) as [CatalogueLocale, string | undefined][]) {
    if (text !== undefined) parsed[locale] = parsePoCatalogue(text);
  }
  return parsed;
}

function scanPlugin(input: PluginCatalogueInput, sharedNonMessageLiterals: readonly string[]): ScannedMessages[] {
  const skipped = new Set([...sharedNonMessageLiterals, ...(input.nonMessageLiterals ?? [])]);
  return input.sources.map((source) => scanDashboardSource(source, skipped));
}

const idsOf = (input: PluginCatalogueInput, scanned: readonly ScannedMessages[]): string[] => [
  ...new Set([...scanned.flatMap((source) => source.ids), ...(input.dynamicIds ?? [])]),
];

/**
 * The ids a plugin dashboard uses: scanned from its sources, then its registered dynamic ids, without repeats.
 * `sharedNonMessageLiterals` are the shell's, which hold for every dashboard (its leaf ids reach `registerShellPage`).
 */
export function usedMessageIds(
  input: PluginCatalogueInput,
  sharedNonMessageLiterals: readonly string[] = [],
): string[] {
  return idsOf(input, scanPlugin(input, sharedNonMessageLiterals));
}

/**
 * Template-literal ids that no registered dynamic id matches, once per template text: their ids cannot be checked
 * otherwise. A template with no dot in its fixed parts never matches (see `TemplateMessageId.pattern`).
 */
function dynamicProblems(input: PluginCatalogueInput, scanned: readonly ScannedMessages[]): CatalogueProblem[] {
  const registered = input.dynamicIds ?? [];
  const unmatched = ({ pattern }: TemplateMessageId): boolean =>
    pattern === null || !registered.some((id) => pattern.test(id));
  const texts = new Set(scanned.flatMap((source) => source.templates.filter(unmatched).map(({ text }) => text)));
  return [...texts].map((id) => ({ plugin: input.plugin, locale: 'en', id, kind: 'dynamic' }));
}

const localesFor = (id: string): readonly CatalogueLocale[] =>
  id.startsWith(FRENCH_ID_PREFIX) ? [...REQUIRED_LOCALES, 'fr'] : REQUIRED_LOCALES;

function gapOf(
  id: string,
  locale: CatalogueLocale,
  own: Catalogues,
  shell: Catalogues,
): CatalogueProblem['kind'] | null {
  const candidates = [own[locale]?.get(id)?.translation, shell[locale]?.get(id)?.translation];
  if (candidates.some((text) => text !== undefined && text.trim() !== '')) return null;
  return candidates.some((text) => text !== undefined) ? 'empty' : 'missing';
}

/** The English entry of `id`: the plugin's own, else the shell's. */
const englishEntry = (id: string, own: Catalogues, shell: Catalogues): PoEntry | undefined =>
  own.en?.get(id) ?? shell.en?.get(id);

/** Own Arabic entries that lack a plural form or category, or drop a plural their English text has. */
function pluralProblems(plugin: string, own: Catalogues, shell: Catalogues): CatalogueProblem[] {
  const flattened = ([id, entry]: [string, PoEntry]): boolean =>
    lacksArabicPluralForms(entry) || flattensEnglishPlural(englishEntry(id, own, shell), entry);
  return [...(own.ar ?? new Map<string, PoEntry>())]
    .filter(flattened)
    .map(([id]) => ({ plugin, locale: 'ar', id, kind: 'plural' }));
}

const entriesOf = (own: Catalogues) => Object.entries(own) as [CatalogueLocale, ParsedCatalogue][];

/** Entries of the plugin's own catalogues still flagged `#, fuzzy`, which Lingui would show unreviewed. */
function fuzzyProblems(plugin: string, own: Catalogues): CatalogueProblem[] {
  return entriesOf(own).flatMap(([locale, catalogue]) =>
    [...catalogue].filter(([, entry]) => entry.fuzzy).map(([id]) => ({ plugin, locale, id, kind: 'fuzzy' as const })),
  );
}

/** Translations of the plugin's own catalogues whose placeholders differ from the English text (own or shell). */
function placeholderProblems(plugin: string, own: Catalogues, shell: Catalogues): CatalogueProblem[] {
  const english = (id: string): string => englishEntry(id, own, shell)?.translation ?? '';
  return entriesOf(own)
    .filter(([locale]) => locale !== 'en')
    .flatMap(([locale, catalogue]) =>
      [...catalogue]
        .filter(([id, entry]) => placeholdersDiffer(english(id), entry.translation))
        .map(([id]) => ({ plugin, locale, id, kind: 'placeholder' as const })),
    );
}

/** The plugin's own non-message literals that one of its catalogues also holds as a message id. */
function literalProblems(plugin: PluginCatalogueInput, own: Catalogues): CatalogueProblem[] {
  return entriesOf(own).flatMap(([locale, catalogue]) =>
    (plugin.nonMessageLiterals ?? [])
      .filter((literal) => catalogue.has(literal))
      .map((id) => ({ plugin: plugin.plugin, locale, id, kind: 'literal' as const })),
  );
}

/**
 * Checks every plugin dashboard against its catalogues (D89). Each used id needs a non-blank translation in English
 * and Arabic, in the plugin's own catalogue or the shell's; a `subdomain.*` id needs French too; an Arabic plural
 * has all six forms or categories and keeps every plural of its English text; no own entry is fuzzy or names other placeholders than its English text; a
 * template-literal id matches a registered dynamic id; a declared non-message literal is no msgid of the plugin's
 * own catalogues. Pure: the caller reads the files.
 */
export function checkCatalogues(input: {
  readonly plugins: readonly PluginCatalogueInput[];
}): readonly CatalogueProblem[] {
  const shellInput = input.plugins.find((entry) => entry.plugin === SHELL_PLUGIN);
  const shell = shellInput ? parseAll(shellInput) : {};
  return input.plugins.flatMap((plugin) => {
    const own = parseAll(plugin);
    const scanned = scanPlugin(plugin, shellInput?.nonMessageLiterals ?? []);
    const gaps = idsOf(plugin, scanned).flatMap((id) =>
      localesFor(id).flatMap((locale) => {
        const kind = gapOf(id, locale, own, shell);
        return kind === null ? [] : [{ plugin: plugin.plugin, locale, id, kind }];
      }),
    );
    return [
      ...gaps,
      ...pluralProblems(plugin.plugin, own, shell),
      ...fuzzyProblems(plugin.plugin, own),
      ...placeholderProblems(plugin.plugin, own, shell),
      ...dynamicProblems(plugin, scanned),
      ...literalProblems(plugin, own),
    ];
  });
}

/** One line of the command's output: `<plugin> <locale> <kind> <id>`. */
export function formatProblem(problem: CatalogueProblem): string {
  return `${problem.plugin} ${problem.locale} ${problem.kind} ${problem.id}`;
}
