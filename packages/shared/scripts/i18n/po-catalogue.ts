/** A `.po` keyword line: the keyword, then one quoted string. */
const KEYWORD_LINE = /^(msgctxt|msgid|msgid_plural|msgstr(?:\[\d+\])?)\s+"((?:[^"\\]|\\.)*)"\s*$/;

/** A continuation line: a quoted string alone, appended to the keyword before it. */
const CONTINUATION_LINE = /^"((?:[^"\\]|\\.)*)"\s*$/;

/** Keywords that open a new entry. */
const ENTRY_START: ReadonlySet<string> = new Set(['msgctxt', 'msgid']);

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', '"': '"', '\\': '\\' };

function unescape(text: string): string {
  return text.replace(/\\(.)/g, (whole, char: string) => ESCAPES[char] ?? whole);
}

/** The entry being read: its id, its translation, and which of the two a continuation line extends. */
interface Entry {
  id: string;
  translation: string;
  target: 'id' | 'translation' | 'none';
}

/** The keyword's text starts the id or extends the translation (plural forms `msgstr[n]` are joined). */
function applyKeyword(entry: Entry, keyword: string, text: string): void {
  if (keyword === 'msgid') {
    entry.id = text;
    entry.target = 'id';
  } else if (keyword.startsWith('msgstr')) {
    entry.translation += text;
    entry.target = 'translation';
  } else {
    entry.target = 'none';
  }
}

function applyContinuation(entry: Entry, text: string): void {
  if (entry.target === 'id') entry.id += text;
  if (entry.target === 'translation') entry.translation += text;
}

const emptyEntry = (): Entry => ({ id: '', translation: '', target: 'none' });

/** Whether `line` opens a new entry while the current one already holds text, so the current one must be stored. */
function startsNextEntry(entry: Entry, line: string): boolean {
  const keyword = KEYWORD_LINE.exec(line)?.[1];
  return keyword !== undefined && ENTRY_START.has(keyword) && entry.target !== 'none';
}

/** Applies a keyword or continuation line to `entry`; any other line is ignored. */
function readLine(entry: Entry, line: string): void {
  const keyword = KEYWORD_LINE.exec(line);
  if (keyword) {
    applyKeyword(entry, keyword[1] ?? '', unescape(keyword[2] ?? ''));
    return;
  }
  const continuation = CONTINUATION_LINE.exec(line);
  if (continuation) applyContinuation(entry, unescape(continuation[1] ?? ''));
}

/**
 * Reads a `.po` catalogue as id to translation. Comments (`#`, including obsolete `#~` entries) are skipped, a
 * continuation line extends the keyword above it, and the header entry (empty id) is left out.
 */
export function parsePoCatalogue(text: string): ReadonlyMap<string, string> {
  const catalogue = new Map<string, string>();
  let entry = emptyEntry();
  const flush = (): void => {
    if (entry.id !== '') catalogue.set(entry.id, entry.translation);
    entry = emptyEntry();
  };
  for (const line of text.split(/\r?\n/).map((raw) => raw.trim())) {
    if (line === '') flush();
    if (line === '' || line.startsWith('#')) continue;
    if (startsNextEntry(entry, line)) flush();
    readLine(entry, line);
  }
  flush();
  return catalogue;
}
