/** Last code point of the C0 control block (U+0000-U+001F). */
const C0_CONTROL_MAX = 0x1f;

/** DEL, the only control character outside the C0 block in 7-bit ASCII. */
const DELETE_CODE_POINT = 0x7f;

const TAB_CODE_POINT = 0x09;
const LINE_FEED_CODE_POINT = 0x0a;
const CARRIAGE_RETURN_CODE_POINT = 0x0d;

/** Tab, line feed and carriage return: the controls multi-line text may legitimately hold. */
const LINE_BREAK_CODE_POINTS: ReadonlySet<number> = new Set([
  TAB_CODE_POINT,
  LINE_FEED_CODE_POINT,
  CARRIAGE_RETURN_CODE_POINT,
]);

/** Options of {@link hasControlCharacter}. */
export interface ControlCharacterOptions {
  /** Accept tab, line feed and carriage return (multi-line fields such as a body). */
  readonly allowLineBreaks?: boolean;
}

function isControlCodePoint(codePoint: number, allowLineBreaks: boolean): boolean {
  if (codePoint > C0_CONTROL_MAX && codePoint !== DELETE_CODE_POINT) {
    return false;
  }
  return !(allowLineBreaks && LINE_BREAK_CODE_POINTS.has(codePoint));
}

/**
 * Tells whether `value` holds an ASCII control character (U+0000-U+001F or U+007F).
 * A NUL breaks Postgres `text`; the others corrupt logs, CSV exports and rendered names.
 *
 * @param options.allowLineBreaks - when true, tab, `\n` and `\r` are not counted
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
