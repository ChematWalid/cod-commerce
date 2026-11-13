import { ACTIVITY_DIFF_MAX_BYTES, DIFF_MAX_DEPTH, DIFF_OMITTED_VALUE, REDACTED_VALUE } from './constants';

/**
 * The D66 terms, matched anywhere inside the words of a key, so `smsotp`, `pinhash` and `xapikey` are secrets too
 * (D800). `api.?key` spans a word break (`api_key`, `API.KEY`, `xApiKey`). The words are also read run together, so a
 * capital inside a term (`passWord` → `pass word`) still matches.
 */
const D66_TERM = /password|secret|token|otp|hash|api.?key|authorization|cookie/;

/**
 * Whole words that hold a D66 term by accident and name no secret. A short list on purpose: a word missing from it
 * is redacted, which only hides a harmless value from the log (D800).
 */
const BENIGN_WORDS: ReadonlySet<string> = new Set(['footprint', 'footprints', 'hashtag', 'hashtags']);

/** Further secrets beyond D66, matched as whole words: `obsession` is not a `session`, `accessKeyboard` no `access key`. */
const SENSITIVE_WORD = /\b(?:sessions?|cvv|credentials?|private ?keys?|access ?keys?)\b/;

/** `API_Key`, `api-key` and `apiKey` all become `api key`. */
const wordsOf = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toLowerCase();

/** The words of `key` without the {@link BENIGN_WORDS}. */
const meaningfulWordsOf = (key: string): string =>
  wordsOf(key)
    .split(' ')
    .filter((word) => !BENIGN_WORDS.has(word))
    .join(' ');

const isSensitiveKey = (key: string): boolean => {
  const words = meaningfulWordsOf(key);
  return D66_TERM.test(words) || D66_TERM.test(words.replaceAll(' ', '')) || SENSITIVE_WORD.test(words);
};

/** What a diff becomes when it is too large to keep. */
export const TRUNCATED_DIFF: Readonly<Record<string, unknown>> = { truncated: true };

const encoder = new TextEncoder();

function sanitizeValue(value: unknown, depth: number, ancestors: ReadonlySet<object>): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object' || value === null) return value;
  if (depth >= DIFF_MAX_DEPTH || ancestors.has(value)) return DIFF_OMITTED_VALUE;
  const path = new Set(ancestors).add(value);
  if (Array.isArray(value)) return (value as unknown[]).map((item) => sanitizeValue(item, depth + 1, path));
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      isSensitiveKey(key) ? REDACTED_VALUE : sanitizeValue(inner, depth + 1, path),
    ]),
  );
}

/**
 * A copy of `diff` that is safe to store: values under sensitive keys are redacted at any depth, arrays are
 * walked, and a diff over {@link ACTIVITY_DIFF_MAX_BYTES} of JSON is replaced by `{ truncated: true }` (D66).
 */
export function sanitizeDiff(diff: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const clean = sanitizeValue(diff, 0, new Set()) as Record<string, unknown>;
  const size = encoder.encode(JSON.stringify(clean)).length;
  return size > ACTIVITY_DIFF_MAX_BYTES ? { ...TRUNCATED_DIFF } : clean;
}
