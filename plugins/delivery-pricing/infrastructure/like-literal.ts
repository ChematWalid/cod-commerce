/** The characters Postgres `LIKE`/`ILIKE` reads as wildcards or as its default escape (`\`). */
const LIKE_SPECIAL = /[\\%_]/g;

/**
 * `text` as a literal inside a Postgres `LIKE`/`ILIKE` pattern with the default escape character, so a fee-group
 * search holding `\`, `%` or `_` matches only itself (copy of catalog's D2234 helper; a plugin never imports another's
 * internals).
 */
export const likeLiteralOf = (text: string): string => text.replace(LIKE_SPECIAL, (special) => `\\${special}`);
