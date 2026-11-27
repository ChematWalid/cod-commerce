/** The separators a CSV may use (D2209): Excel writes `;` on an Arabic or French Windows, `,` elsewhere. */
export const CSV_DELIMITERS = [',', ';', '\t'] as const;

/** One of the {@link CSV_DELIMITERS}. */
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/** Lines a detection looks at. */
const SAMPLE_LINES = 10;
const QUOTE = '"';
const LINE_BREAK = /\r?\n/;

/** How often `delimiter` occurs in `line` outside quoted text. */
function countOutsideQuotes(line: string, delimiter: CsvDelimiter): number {
  let count = 0;
  let quoted = false;
  for (const character of line) {
    if (character === QUOTE) quoted = !quoted;
    else if (!quoted && character === delimiter) count += 1;
  }
  return count;
}

/** How consistently `delimiter` splits the lines: the most frequent non-zero count's frequency, then the count. */
function scoreOf(lines: readonly string[], delimiter: CsvDelimiter): readonly [number, number] {
  const frequency = new Map<number, number>();
  for (const line of lines) {
    const count = countOutsideQuotes(line, delimiter);
    if (count > 0) frequency.set(count, (frequency.get(count) ?? 0) + 1);
  }
  let best: readonly [number, number] = [0, 0];
  for (const [count, times] of frequency) {
    if (times > best[0] || (times === best[0] && count > best[1])) best = [times, count];
  }
  return best;
}

const beats = (left: readonly [number, number], right: readonly [number, number]): boolean =>
  left[0] > right[0] || (left[0] === right[0] && left[1] > right[1]);

/**
 * The separator of a CSV text (D2209, Review Focus 1): the candidate that splits the most of the first lines into the
 * same number of fields, quoted text ignored; a tie keeps the earlier of `,`, `;`, tab, and a one-column file is `,`.
 */
export function detectDelimiter(text: string): CsvDelimiter {
  const lines = text
    .split(LINE_BREAK)
    .filter((line) => line.trim() !== '')
    .slice(0, SAMPLE_LINES);
  let chosen: CsvDelimiter = CSV_DELIMITERS[0];
  let chosenScore = scoreOf(lines, chosen);
  for (const delimiter of CSV_DELIMITERS.slice(1)) {
    const score = scoreOf(lines, delimiter);
    if (beats(score, chosenScore)) {
      chosen = delimiter;
      chosenScore = score;
    }
  }
  return chosen;
}
