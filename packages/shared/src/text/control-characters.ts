/** Last code point of the C0 control block (U+0000-U+001F). */
const C0_CONTROL_MAX = 0x1f;

/** DEL, the only control character outside the C0 block in 7-bit ASCII. */
const DELETE_CODE_POINT = 0x7f;

/** First and last code points of the C1 control block (U+0080-U+009F). */
const C1_CONTROL_MIN = 0x80;
const C1_CONTROL_MAX = 0x9f;

const LINE_SEPARATOR_CODE_POINT = 0x2028;
const PARAGRAPH_SEPARATOR_CODE_POINT = 0x2029;

const TAB_CODE_POINT = 0x09;
const LINE_FEED_CODE_POINT = 0x0a;
const CARRIAGE_RETURN_CODE_POINT = 0x0d;

/** Tab and the line breaks (`\r`, `\n`, U+2028, U+2029): the controls multi-line text may legitimately hold. */
const LINE_BREAK_CODE_POINTS: ReadonlySet<number> = new Set([
  TAB_CODE_POINT,
  LINE_FEED_CODE_POINT,
  CARRIAGE_RETURN_CODE_POINT,
  LINE_SEPARATOR_CODE_POINT,
  PARAGRAPH_SEPARATOR_CODE_POINT,
]);

/** Options of {@link hasControlCharacter}. */
export interface ControlCharacterOptions {
  /** Accept tab and the line breaks (`\n`, `\r`, U+2028, U+2029), for multi-line fields such as a body. */
  readonly allowLineBreaks?: boolean;
}

function isControlOrLineBreak(codePoint: number): boolean {
  return (
    codePoint <= C0_CONTROL_MAX ||
    codePoint === DELETE_CODE_POINT ||
    (codePoint >= C1_CONTROL_MIN && codePoint <= C1_CONTROL_MAX) ||
    LINE_BREAK_CODE_POINTS.has(codePoint)
  );
}

function isControlCodePoint(codePoint: number, allowLineBreaks: boolean): boolean {
  if (!isControlOrLineBreak(codePoint)) {
    return false;
  }
  return !(allowLineBreaks && LINE_BREAK_CODE_POINTS.has(codePoint));
}

/**
 * Tells whether `value` holds a control character: C0 (U+0000-U+001F), DEL, C1 (U+0080-U+009F)
 * or the Unicode line and paragraph separators (U+2028, U+2029).
 * A NUL breaks Postgres `text`; the others corrupt logs, CSV exports and rendered names.
 * Bidi controls are left to {@link hasBidiControl}: multi-line text pasted from an editor may hold embeddings.
 *
 * @param options.allowLineBreaks - when true, tab, `\n`, `\r`, U+2028 and U+2029 are not counted
 */
export function hasControlCharacter(value: string, options: ControlCharacterOptions = {}): boolean {
  const allowLineBreaks = options.allowLineBreaks ?? false;
  for (const character of value) {
    if (isControlCodePoint(character.codePointAt(0) ?? 0, allowLineBreaks)) {
      return true;
    }
  }
  return false;
}

/** The embedding and override controls LRE, RLE, PDF, LRO and RLO (U+202A-U+202E). */
const BIDI_EMBEDDING_MIN = 0x202a;
const BIDI_EMBEDDING_MAX = 0x202e;
/** The isolate controls LRI, RLI, FSI and PDI (U+2066-U+2069). */
const BIDI_ISOLATE_MIN = 0x2066;
const BIDI_ISOLATE_MAX = 0x2069;

function isBidiControlCodePoint(codePoint: number): boolean {
  return (
    (codePoint >= BIDI_EMBEDDING_MIN && codePoint <= BIDI_EMBEDDING_MAX) ||
    (codePoint >= BIDI_ISOLATE_MIN && codePoint <= BIDI_ISOLATE_MAX)
  );
}

/**
 * Tells whether `value` holds a bidi embedding, override or isolate control (U+202A-U+202E, U+2066-U+2069).
 * They reorder the text shown in the dashboard and in logs ('Invoice' + RLO + 'fdp.exe' reads as an .exe name,
 * Trojan Source), so single-line fields such as a title or a name refuse them alongside {@link hasControlCharacter}.
 * The direction marks Arabic text needs, LRM (U+200E), RLM (U+200F) and ALM (U+061C), are not counted.
 */
export function hasBidiControl(value: string): boolean {
  for (const character of value) {
    if (isBidiControlCodePoint(character.codePointAt(0) ?? 0)) {
      return true;
    }
  }
  return false;
}
