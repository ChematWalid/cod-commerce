/** What the check needs from an ICU message: its argument names, its plural arguments and each plural's selectors. */
export interface IcuSummary {
  readonly argumentNames: ReadonlySet<string>;
  /** The names of the arguments formatted as `plural`, such as `count` in `{count, plural, …}`. */
  readonly pluralArguments: ReadonlySet<string>;
  readonly pluralSelectors: readonly (readonly string[])[];
}

/** Argument types whose body is a list of `selector {message}` options. */
const OPTION_TYPES: ReadonlySet<string> = new Set(['plural', 'select', 'selectordinal']);

const ARGUMENT_NAME = /^\w+$/;

interface Cursor {
  readonly text: string;
  index: number;
  readonly names: Set<string>;
  readonly pluralNames: Set<string>;
  readonly plurals: string[][];
}

/** Reads up to (not past) the next character in `stops`, returning what it skipped. */
function readUntil(cursor: Cursor, stops: string): string {
  const start = cursor.index;
  while (cursor.index < cursor.text.length && !stops.includes(cursor.text[cursor.index] ?? '')) cursor.index += 1;
  return cursor.text.slice(start, cursor.index);
}

/** Skips a balanced `{…}` remainder whose opening brace is already consumed. */
function skipToClose(cursor: Cursor): void {
  let depth = 1;
  while (cursor.index < cursor.text.length && depth > 0) {
    const char = cursor.text[cursor.index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    cursor.index += 1;
  }
}

/** Reads `selector {message}` options until the argument's closing brace; a plural's selectors are recorded. */
function readOptions(cursor: Cursor, isPlural: boolean): void {
  const selectors: string[] = [];
  while (cursor.index < cursor.text.length) {
    const token = readUntil(cursor, '{}');
    const stop = cursor.text[cursor.index];
    cursor.index += 1;
    if (stop !== '{') break;
    selectors.push(token.trim().split(/\s+/).pop() ?? '');
    readMessage(cursor, true);
    cursor.index += 1;
  }
  if (isPlural) cursor.plurals.push(selectors);
}

/** Reads `{name}`, `{name, type}` or `{name, type, …}`; the opening brace is already consumed. */
function readArgument(cursor: Cursor): void {
  const name = readUntil(cursor, ',}').trim();
  if (ARGUMENT_NAME.test(name)) cursor.names.add(name);
  if (cursor.text[cursor.index++] !== ',') return;
  const type = readUntil(cursor, ',}').trim();
  if (cursor.text[cursor.index++] !== ',') return;
  if (type === 'plural') cursor.pluralNames.add(name);
  if (OPTION_TYPES.has(type)) readOptions(cursor, type === 'plural');
  else skipToClose(cursor);
}

/** Reads message text; a nested message stops before the `}` that closes it. */
function readMessage(cursor: Cursor, nested: boolean): void {
  while (cursor.index < cursor.text.length) {
    const char = cursor.text[cursor.index];
    if (char === '}' && nested) return;
    cursor.index += 1;
    if (char === '{') readArgument(cursor);
  }
}

/**
 * Summarises an ICU message (Lingui's catalogue format) without validating it. Apostrophe quoting is not
 * interpreted; a malformed message yields what could be read.
 */
export function summariseIcu(text: string): IcuSummary {
  const cursor: Cursor = { text, index: 0, names: new Set(), pluralNames: new Set(), plurals: [] };
  readMessage(cursor, false);
  return { argumentNames: cursor.names, pluralArguments: cursor.pluralNames, pluralSelectors: cursor.plurals };
}
