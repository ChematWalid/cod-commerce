/** A `.po` keyword line: the keyword, an optional plural index, then one quoted string. */
const KEYWORD_LINE = /^(msgctxt|msgid|msgid_plural|msgstr(?:\[(\d+)\])?)\s+"((?:[^"\\]|\\.)*)"\s*$/;

/** A continuation line: a quoted string alone, appended to the keyword before it. */
const CONTINUATION_LINE = /^"((?:[^"\\]|\\.)*)"\s*$/;

/** A flags comment (`#, fuzzy, c-format`); it belongs to the entry that follows it. */
const FLAGS_LINE = /^#,(.*)$/;

const FUZZY_FLAG = 'fuzzy';

/** Keywords that open a new entry. */
const ENTRY_START: ReadonlySet<string> = new Set(['msgctxt', 'msgid']);

const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', '"': '"', '\\': '\\' };

function unescape(text: string): string {
  return text.replace(/\\(.)/g, (whole, char: string) => ESCAPES[char] ?? whole);
}

/** One catalogue entry as the check reads it. */
export interface PoEntry {
  /** The translation; the forms of a gettext plural joined in order. */
  readonly translation: string;
  /** Each `msgstr[n]` of a gettext plural by index; the single `msgstr` otherwise. */
  readonly forms: readonly string[];
  /** Whether the entry declares `msgid_plural` (a gettext plural). */
  readonly plural: boolean;
  /** Whether a `#, fuzzy` flag marks the translation as unreviewed. */
  readonly fuzzy: boolean;
}

/** The entry being read, and which of its strings a continuation line extends. */
interface Entry {
  id: string;
  /** Sparse while reading: a catalogue may skip a `msgstr[n]` index. */
  forms: (string | undefined)[];
  plural: boolean;
  fuzzy: boolean;
  target: 'id' | 'translation' | 'none';
  form: number;
}

const emptyEntry = (): Entry => ({ id: '', forms: [], plural: false, fuzzy: false, target: 'none', form: 0 });

/** The keyword's text starts the id or one translation form (`msgstr` is form 0). */
function applyKeyword(entry: Entry, keyword: KeywordMatch): void {
  if (keyword.name === 'msgid') {
    entry.id = keyword.text;
    entry.target = 'id';
  } else if (keyword.name.startsWith('msgstr')) {
    entry.form = keyword.index;
    entry.forms[keyword.index] = (entry.forms[keyword.index] ?? '') + keyword.text;
    entry.target = 'translation';
  } else {
    entry.plural ||= keyword.name === 'msgid_plural';
    entry.target = 'none';
  }
}

function applyContinuation(entry: Entry, text: string): void {
  if (entry.target === 'id') entry.id += text;
  if (entry.target === 'translation') entry.forms[entry.form] = (entry.forms[entry.form] ?? '') + text;
}

interface KeywordMatch {
  readonly name: string;
  readonly index: number;
  readonly text: string;
}

function keywordOf(line: string): KeywordMatch | null {
  const match = KEYWORD_LINE.exec(line);
  if (!match) return null;
  return { name: match[1] ?? '', index: Number(match[2] ?? '0'), text: unescape(match[3] ?? '') };
}

/** Whether `line` opens a new entry while the current one already holds text, so the current one must be stored. */
function startsNextEntry(entry: Entry, line: string): boolean {
  const keyword = keywordOf(line);
  if (keyword !== null) return ENTRY_START.has(keyword.name) && entry.target !== 'none';
  return FLAGS_LINE.test(line) && entry.target !== 'none';
}

/** Applies a flags, keyword or continuation line to `entry`; any other line (comments included) is ignored. */
function readLine(entry: Entry, line: string): void {
  const flags = FLAGS_LINE.exec(line);
  if (flags) {
    entry.fuzzy ||= (flags[1] ?? '').split(',').some((flag) => flag.trim() === FUZZY_FLAG);
    return;
  }
  const keyword = keywordOf(line);
  if (keyword) {
    applyKeyword(entry, keyword);
    return;
  }
  const continuation = CONTINUATION_LINE.exec(line);
  if (continuation) applyContinuation(entry, unescape(continuation[1] ?? ''));
}

const toPoEntry = (entry: Entry): PoEntry => {
  const forms = Array.from(entry.forms, (form) => form ?? '');
  return { translation: forms.join(''), forms, plural: entry.plural, fuzzy: entry.fuzzy };
};

/**
 * Reads a `.po` catalogue as id to entry. Comments other than `#,` flags (including obsolete `#~` entries) are
 * skipped, a continuation line extends the keyword above it, and the header entry (empty id) is left out.
 */
export function parsePoCatalogue(text: string): ReadonlyMap<string, PoEntry> {
  const catalogue = new Map<string, PoEntry>();
  let entry = emptyEntry();
  const flush = (): void => {
    if (entry.id !== '') catalogue.set(entry.id, toPoEntry(entry));
    entry = emptyEntry();
  };
  for (const line of text.split(/\r?\n/).map((raw) => raw.trim())) {
    if (line === '') flush();
    if (line === '' || (line.startsWith('#') && !FLAGS_LINE.test(line))) continue;
    if (startsNextEntry(entry, line)) flush();
    readLine(entry, line);
  }
  flush();
  return catalogue;
}
