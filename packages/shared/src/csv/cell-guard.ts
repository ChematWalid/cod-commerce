/** First characters that make a spreadsheet read a text cell as a formula (D2209, Review Focus 2). */
const FORMULA_TRIGGERS: ReadonlySet<string> = new Set(['=', '+', '-', '@', '\t', '\r']);
/** What a guarded cell starts with; spreadsheets show it as a text marker. */
const GUARD_PREFIX = "'";
/** Leading whitespace a spreadsheet skips before reading a formula; tab and CR are triggers themselves. */
const SKIPPED_LEADING = /^[^\S\t\r]*/u;

/** Whether the first character after skipped whitespace is a formula trigger. */
function startsLikeFormula(value: string): boolean {
  const rest = value.replace(SKIPPED_LEADING, '');
  return rest !== '' && FORMULA_TRIGGERS.has(rest.charAt(0));
}

/**
 * Whether `value` needs the guard: it starts like a formula, or it is a run of quotes before one, so a text that
 * already starts with the guard round-trips too (D2256): `'=x` is written `''=x` and reads back `'=x`.
 */
function needsGuard(value: string): boolean {
  let rest = value;
  while (rest.startsWith(GUARD_PREFIX)) rest = rest.slice(GUARD_PREFIX.length);
  return startsLikeFormula(rest);
}

/**
 * The cell as an export writes it (D2209): a text whose first non-whitespace character is `=`, `+`, `-`, `@`, a tab
 * or a CR gets a leading `'`, so no spreadsheet runs it; numbers and empty cells are never touched.
 */
export function guardCell<Cell extends string | number | null>(value: Cell): Cell {
  if (typeof value !== 'string' || !needsGuard(value)) return value;
  return `${GUARD_PREFIX}${value}` as Cell;
}

/** The text a guarded cell held: one leading `'` is dropped only when {@link guardCell} would have added it. */
export function unguardCell(value: string): string {
  if (!value.startsWith(GUARD_PREFIX)) return value;
  const rest = value.slice(GUARD_PREFIX.length);
  return needsGuard(rest) ? rest : value;
}
