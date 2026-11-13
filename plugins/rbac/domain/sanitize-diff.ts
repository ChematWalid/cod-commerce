import {
  ACTIVITY_DIFF_MAX_BYTES,
  DIFF_MAX_DEPTH,
  DIFF_MAX_KEY_LENGTH,
  DIFF_OMITTED_VALUE,
  REDACTED_VALUE,
} from './constants';

/**
 * The secret terms: those of D66 and the extras of P1.S3 (`session`, `cvv`, `credential`, `private key`, `access
 * key`), matched anywhere in a key read as one run of lowercase letters and digits, so `smsotp`, `pinhash`,
 * `passWord`, `api_key`, `sessionid` and `cvv2` are secrets (D800). Sticky, so it is tried at each position in turn.
 */
const SECRET_TERM =
  /password|secret|token|otp|hash|api.?key|authorization|cookie|session|cvv|credential|(?:private|access)[a-z0-9]{0,16}?key/y;

/**
 * Whole words that hold a secret term by accident and name no secret. A match is exempt only when it lies entirely
 * inside one of them, so `footprintOken` (`footprint` + `oken`, holding `token`) is still a secret. A short list on
 * purpose: a word missing from it is redacted, which only hides a harmless value from the log (D800).
 */
const BENIGN_WORDS: ReadonlySet<string> = new Set([
  'footprint',
  'footprints',
  'hashtag',
  'hashtags',
  'obsession',
  'obsessions',
]);

/** `API_Key`, `api-key` and `apiKey` become `api key`; any other character separates words. */
const wordsOf = (key: string): string[] =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])(?=[A-Z][a-z])/g, '$1 ')
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

/** Whether `run` holds a secret term that does not lie entirely inside one benign span. */
function holdsSecretTerm(run: string, benign: readonly (readonly [number, number])[]): boolean {
  for (let index = 0; index < run.length; index += 1) {
    SECRET_TERM.lastIndex = index;
    const match = SECRET_TERM.exec(run);
    if (match === null) continue;
    const end = index + match[0].length;
    if (!benign.some(([from, to]) => from <= index && end <= to)) return true;
  }
  return false;
}

/** One character as its ASCII letters: decomposed, marks dropped, `ß` as `ss`; anything else separates words. */
const asciiOf = (character: string): string => {
  if (character === 'ß' || character === 'ẞ') return 'ss';
  const base = character.normalize('NFKD').replace(/\p{M}/gu, '');
  return /^[A-Za-z0-9]$/.test(base) ? base : ' ';
};

/**
 * The ways a key is read; it is secret when any reading holds a term. As typed, a non-ASCII character separates words
 * (as in P1.S3), so `api™key` and `pass` + zero-width space + `word` still match. Decomposed with its marks dropped,
 * a fullwidth or accented letter reads as its ASCII base (`ｐａｓｓｗｏｒｄ`, `tokeń`). Character by character, a
 * letter reads as its base and a symbol NFKD would widen (`™` → `TM`) separates words (`ａｐｉ™ｋｅｙ`, `paßword`).
 */
const READINGS: readonly ((key: string) => string)[] = [
  (key) => key,
  (key) => key.normalize('NFKD').replace(/\p{M}/gu, ''),
  (key) => Array.from(key, asciiOf).join(''),
];

/** A key too long to read is redacted unread, which also bounds the work per key. */
const isSensitiveKey = (key: string): boolean => {
  if (key.length > DIFF_MAX_KEY_LENGTH) return true;
  return READINGS.some((read) => {
    const words = wordsOf(read(key));
    return holdsSecretTerm(words.join(''), benignSpansOf(words));
  });
};

/** What a diff becomes when it is too large to keep. */
export const TRUNCATED_DIFF: Readonly<Record<string, unknown>> = { truncated: true };

const encoder = new TextEncoder();

function sanitizeValue(value: unknown, depth: number, ancestors: ReadonlySet<object>): unknown {
  if (typeof value === 'bigint') return value.toString();
  // A function never belongs in a diff, and an own `toJSON` would write whatever it returns unsanitized.
  if (typeof value === 'function') return DIFF_OMITTED_VALUE;
  // The real clock time, never a subclass's own `toISOString`; an invalid date has none.
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? DIFF_OMITTED_VALUE : Date.prototype.toISOString.call(value);
  }
  if (typeof value !== 'object' || value === null) return value;
  if (depth >= DIFF_MAX_DEPTH || ancestors.has(value)) return DIFF_OMITTED_VALUE;
  const path = new Set(ancestors).add(value);
  // A plain copy: an Array subclass's own `map` or prototype `toJSON` never runs.
  if (Array.isArray(value)) {
    const items = value as unknown[];
    return Array.from({ length: items.length }, (_, index) => sanitizeValue(items[index], depth + 1, path));
  }
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
