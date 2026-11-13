import { ACTIVITY_DIFF_MAX_BYTES, DIFF_MAX_DEPTH, DIFF_OMITTED_VALUE, REDACTED_VALUE } from './constants';

/**
 * The D66 terms, matched anywhere in a key read as one run of lowercase letters and digits, so `smsotp`, `pinhash`,
 * `passWord`, `api_key` and `xApiKey` are secrets (D800). Sticky, so it is tried at each position in turn.
 */
const D66_TERM = /password|secret|token|otp|hash|api.?key|authorization|cookie/y;

/**
 * Whole words that hold a D66 term by accident and name no secret. A match is exempt only when it lies entirely
 * inside one of them, so `footprintOken` (`footprint` + `oken`, holding `token`) is still a secret. A short list on
 * purpose: a word missing from it is redacted, which only hides a harmless value from the log (D800).
 */
const BENIGN_WORDS: ReadonlySet<string> = new Set(['footprint', 'footprints', 'hashtag', 'hashtags']);

/** Further secrets beyond D66, matched as whole words: `obsession` is not a `session`, `accessKeyboard` no `access key`. */
const SENSITIVE_WORD = /\b(?:sessions?|cvv|credentials?|private ?keys?|access ?keys?)\b/;

/** `API_Key`, `api-key` and `apiKey` all become `api key`. */
const wordsOf = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter((word) => word !== '');

/** Where each benign word of `words` starts and ends once the words are run together. */
function benignSpansOf(words: readonly string[]): (readonly [number, number])[] {
  const spans: (readonly [number, number])[] = [];
  let start = 0;
  for (const word of words) {
    if (BENIGN_WORDS.has(word)) spans.push([start, start + word.length]);
    start += word.length;
  }
  return spans;
}

/** Whether `run` holds a D66 term that does not lie entirely inside one benign span. */
function holdsD66Term(run: string, benign: readonly (readonly [number, number])[]): boolean {
  for (let index = 0; index < run.length; index += 1) {
    D66_TERM.lastIndex = index;
    const match = D66_TERM.exec(run);
    if (match === null) continue;
    const end = index + match[0].length;
    if (!benign.some(([from, to]) => from <= index && end <= to)) return true;
  }
  return false;
}

const isSensitiveKey = (key: string): boolean => {
  const words = wordsOf(key);
  return holdsD66Term(words.join(''), benignSpansOf(words)) || SENSITIVE_WORD.test(words.join(' '));
};

/** What a diff becomes when it is too large to keep. */
export const TRUNCATED_DIFF: Readonly<Record<string, unknown>> = { truncated: true };

const encoder = new TextEncoder();

function sanitizeValue(value: unknown, depth: number, ancestors: ReadonlySet<object>): unknown {
  if (typeof value === 'bigint') return value.toString();
  // A function never belongs in a diff, and an own `toJSON` would write whatever it returns unsanitized.
  if (typeof value === 'function') return DIFF_OMITTED_VALUE;
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
