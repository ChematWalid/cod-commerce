/**
 * The `.env.example` gate: a variable the code or compose reads is documented where an operator copies it from.
 * The functions are pure; `tests/env-example.test.ts` feeds them the real files.
 */

const NAME = '[A-Za-z_][A-Za-z0-9_]*';

/** `KEY=value`, or `# KEY=value` for an optional variable whose default is right (prose comments have no `KEY=`). */
const DOCUMENTED_KEY = new RegExp(`^(?:#\\s*)?(${NAME})=`);

/**
 * One step through a compose value: an escaped dollar (`$$`, consumed so that what follows it is read on its own),
 * a braced variable (`${VAR}`, with or without a default) or a bare one (`$VAR`).
 */
const COMPOSE_TOKEN = new RegExp(`\\$\\$|\\$\\{(${NAME})|\\$(${NAME})`, 'g');

/** The example every `.env` is copied from: the one env file that is committed. */
const EXAMPLE_FILE = '.env.example';
/** `.env`, `.env.local` and the like; `prod.env`; and direnv's `.envrc`, which holds the same values. */
const ENV_FILE_NAMES = [/^\.env(\..+)?$/, /\.env$/, /^\.envrc$/];

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

/**
 * The variables a compose file (or a shell command) takes from the caller's environment or `.env`: `${VAR}`,
 * `${VAR:-default}` with the variables nested in the default, and `$VAR`. `$$` is an escaped dollar, not a variable.
 */
export function composeVariables(compose: string): Set<string> {
  const names = new Set<string>();
  for (const [, braced, bare] of compose.matchAll(COMPOSE_TOKEN)) {
    const name = braced ?? bare;
    if (name !== undefined) {
      names.add(name);
    }
  }
  return names;
}

/** True for a path that would hold real values: any env file except a `.env.example`. */
export function isEnvFile(path: string): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name !== EXAMPLE_FILE && ENV_FILE_NAMES.some((pattern) => pattern.test(name));
}

/** The `required` names that are neither in `present` nor exempt, sorted for a stable failure message. */
export function missingKeys(
  required: Iterable<string>,
  present: ReadonlySet<string>,
  exempt: Readonly<Record<string, string>> = {},
): string[] {
  return [...new Set(required)].filter((key) => !present.has(key) && !(key in exempt)).sort();
}
