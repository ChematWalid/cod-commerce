import { searchQueryTokens, STOREFRONT_SEARCH_MAX_QUERY, STOREFRONT_SEARCH_MIN_QUERY } from '@cod/shared';
import { STOREFRONT_SEARCH_MAX_VARIANTS } from './constants';

/** A buyer's search in search normal form (ADR 0014): its words, article stripped, and the words joined by spaces. */
export interface SearchQuery {
  readonly text: string;
  readonly tokens: readonly string[];
}

/** One synonym of a business, both sides in search normal form; it applies in both directions. */
export interface SynonymPair {
  readonly term: string;
  readonly expansion: string;
}

/** The first `max` characters (code points, so a pair is never cut) of `text`. */
const firstCharacters = (text: string, max: number): string => Array.from(text).slice(0, max).join('');

/**
 * The search of a raw `q`: at most {@link STOREFRONT_SEARCH_MAX_QUERY} characters are read, before and after
 * normalisation (NFKC can lengthen a ligature). `undefined` when `q` is not one string or its normal form is shorter than
 * {@link STOREFRONT_SEARCH_MIN_QUERY}: the API then answers an empty page, never an error.
 */
export function searchQueryOf(raw: unknown): SearchQuery | undefined {
  if (typeof raw !== 'string') return undefined;
  const normal = firstCharacters(
    searchQueryTokens(firstCharacters(raw, STOREFRONT_SEARCH_MAX_QUERY)).join(' '),
    STOREFRONT_SEARCH_MAX_QUERY,
  );
  const tokens = normal.split(' ').filter((word) => word.length > 0);
  const text = tokens.join(' ');
  return Array.from(text).length < STOREFRONT_SEARCH_MIN_QUERY ? undefined : { text, tokens };
}

/** The other side of every pair that has `word` on one side. */
const alternativesOf = (word: string, synonyms: readonly SynonymPair[]): string[] =>
  synonyms.flatMap(({ term, expansion }) => {
    if (term === word) return [expansion];
    return expansion === word ? [term] : [];
  });

/** The terms whose synonyms a search needs: each word once, then the whole query (a multi-word term). */
export const synonymLookupTerms = (query: SearchQuery): string[] => [...new Set([...query.tokens, query.text])];

/**
 * The texts one search matches (ADR 0014 Darija risk): the query itself first, then the whole query swapped for its
 * synonyms, then each word swapped for each of its synonyms in turn. Distinct, at most `max`, so a business with many
 * synonyms never makes one search unbounded.
 */
export function queryVariants(
  query: SearchQuery,
  synonyms: readonly SynonymPair[],
  max: number = STOREFRONT_SEARCH_MAX_VARIANTS,
): string[] {
  const swapped = query.tokens.flatMap((word, index) =>
    alternativesOf(word, synonyms).map((alternative) =>
      query.tokens.map((other, at) => (at === index ? alternative : other)).join(' '),
    ),
  );
  const variants = [query.text, ...alternativesOf(query.text, synonyms), ...swapped];
  return [...new Set(variants)].slice(0, max);
}
