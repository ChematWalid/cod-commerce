/**
 * The `.env.example` gate: a variable the code or compose reads is documented where an operator copies it from.
 * The functions are pure; `tests/env-example.test.ts` feeds them the real files.
 */

/** `KEY=value`, or `# KEY=value` for an optional variable whose default is right (prose comments have no `KEY=`). */
const DOCUMENTED_KEY = /^(?:#\s*)?([A-Z][A-Z0-9_]*)=/;

/** A `${VAR}` compose interpolates, with or without a default; `$${VAR}` is escaped and left to the container. */
const COMPOSE_VARIABLE = /(?<!\$)\$\{([A-Z][A-Z0-9_]*)/g;

/** The variables an env example documents, set or commented out. */
export function documentedKeys(example: string): Set<string> {
  const keys = new Set<string>();
  for (const line of example.split('\n')) {
    const key = DOCUMENTED_KEY.exec(line.trim())?.[1];
    if (key !== undefined) {
      keys.add(key);
    }
  }
  return keys;
}

/** The variables a compose file takes from the caller's environment or `.env`, defaults' nested ones included. */
export function composeVariables(compose: string): Set<string> {
  return new Set([...compose.matchAll(COMPOSE_VARIABLE)].flatMap(([, name]) => (name === undefined ? [] : [name])));
}

/** The `required` names that are neither in `present` nor exempt, sorted for a stable failure message. */
export function missingKeys(
  required: Iterable<string>,
  present: ReadonlySet<string>,
  exempt: Readonly<Record<string, string>> = {},
): string[] {
  return [...new Set(required)].filter((key) => !present.has(key) && !(key in exempt)).sort();
}
