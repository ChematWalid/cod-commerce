/** The characters Postgres `LIKE`/`ILIKE` reads as wildcards or as its default escape (`\`). */
const LIKE_SPECIAL = /[\\%_]/g;

/**
 * `text` as a literal inside a Postgres `LIKE`/`ILIKE` pattern with the default escape character: Vendure's `contains`
 * filter wraps its operand in `%…%` without escaping, so a SKU holding `\`, `%` or `_` would otherwise match other
 * SKUs, miss itself, or end the pattern with the escape character (a database error) (D2234).
 */
export const likeLiteralOf = (text: string): string => text.replace(LIKE_SPECIAL, (special) => `\\${special}`);
