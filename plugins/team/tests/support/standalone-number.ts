/**
 * Matches `value` only as a number of its own. Ids and timestamps are long digit runs that may contain a short value
 * by chance, so a leak check looks for the standalone number, never a bare substring.
 */
export function standaloneNumber(value: number): RegExp {
  return new RegExp(`(?<!\\d)${String(value)}(?!\\d)`);
}
