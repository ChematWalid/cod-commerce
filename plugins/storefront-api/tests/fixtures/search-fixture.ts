import { FIXTURE_QUERIES, type FixtureQuery } from './search-fixture-queries';
import {
  FIXTURE_VOCABULARIES,
  type FixtureScript,
  type FixtureTerm,
  type FixtureVocabulary,
} from './search-fixture-vocabulary';

/**
 * The storefront search recall fixture (D3208), re-created from spike E's shape (ADR 0014): 300 product names over 3
 * stores and 60 queries tagged by class. Expected results follow spike E's fixed rule, never a hand list: the query's
 * store, every concept tag of the query, and the query's script (both scripts for the cross-script Darija queries).
 */

/** A fixture product: its key (`store/index`), store, name, concept tags and script. */
export interface FixtureProduct {
  readonly key: string;
  readonly store: number;
  readonly name: string;
  readonly tags: readonly string[];
  readonly script: FixtureScript;
}

/** How deep the gate reads each answer. */
export const RECALL_DEPTH = 5;

/** The recall the gate requires (ADR 0014 acceptance rule). */
export const RECALL_TARGET = 0.85;

const spell = (term: FixtureTerm, turn: number): string => term.spellings[turn % term.spellings.length] ?? term.tag;

/**
 * The names of one block: round `r` pairs noun `n` with modifier `(n + r) mod modifiers`, so the rounds walk every
 * noun/modifier pair once, and the spellings rotate so every variant of a concept is in the store.
 */
function namesOf(vocabulary: FixtureVocabulary): Omit<FixtureProduct, 'key'>[] {
  const { nouns, modifiers } = vocabulary;
  return Array.from({ length: vocabulary.count }, (_, index) => {
    const round = Math.floor(index / nouns.length);
    const at = index % nouns.length;
    const noun = nouns[at] ?? nouns[0];
    const modifier = modifiers[(at + round) % modifiers.length] ?? modifiers[0];
    if (noun === undefined || modifier === undefined) throw new Error('a fixture block needs nouns and modifiers');
    const name = `${spell(noun, round)} ${spell(modifier, index)}`;
    return { store: vocabulary.store, name, tags: [noun.tag, modifier.tag], script: vocabulary.script };
  });
}

/** Every fixture product, keyed `store/index` in the order the blocks list them. */
export const FIXTURE_PRODUCTS: readonly FixtureProduct[] = FIXTURE_VOCABULARIES.flatMap(namesOf).map(
  (product, index) => ({ ...product, key: `${String(product.store)}/${String(index)}` }),
);

export { FIXTURE_QUERIES, type FixtureQuery };

/** The keys spike E's rule expects for `query`. */
export function expectedKeysOf(query: FixtureQuery, products: readonly FixtureProduct[] = FIXTURE_PRODUCTS): string[] {
  return products
    .filter((product) => product.store === query.store)
    .filter((product) => query.tags.every((tag) => product.tags.includes(tag)))
    .filter((product) => query.crossScript === true || product.script === query.script)
    .map((product) => product.key);
}

/** One query's answer as the gate scores it. */
export interface ScoredQuery {
  readonly recall: number;
  readonly reciprocalRank: number;
}

/**
 * Recall at {@link RECALL_DEPTH} (expected keys found in the first answers over the most that fit, `min(|expected|,
 * depth)`) and the reciprocal rank of the first expected key.
 */
export function scoreOf(expected: readonly string[], answered: readonly string[]): ScoredQuery {
  const wanted = new Set(expected);
  const top = answered.slice(0, RECALL_DEPTH);
  const found = top.filter((key) => wanted.has(key)).length;
  const firstHit = top.findIndex((key) => wanted.has(key));
  return {
    recall: expected.length === 0 ? 0 : found / Math.min(expected.length, RECALL_DEPTH),
    reciprocalRank: firstHit < 0 ? 0 : 1 / (firstHit + 1),
  };
}
