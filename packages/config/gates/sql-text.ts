/** What a `${}` hole of a template becomes: an identifier, so a dynamic name or flag still has SQL shape. */
export const TEMPLATE_HOLE = 'hole_';

const DOLLAR_TAG = /^\$[A-Za-z_]*\$/;

/** Length of a single-quoted string starting at `start` (`''` is an escaped quote), to its end or the text's end. */
function quotedLength(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === "'" && sql[index + 1] === "'") index += 2;
    else if (sql[index] === "'") return index + 1 - start;
    else index += 1;
  }
  return sql.length - start;
}

/** Length of a block comment starting at `start`; Postgres nests block comments. */
function blockCommentLength(sql: string, start: number): number {
  let depth = 0;
  let index = start;
  while (index < sql.length) {
    if (sql.startsWith('/*', index)) {
      depth += 1;
      index += 2;
    } else if (sql.startsWith('*/', index)) {
      depth -= 1;
      index += 2;
      if (depth === 0) return index - start;
    } else index += 1;
  }
  return sql.length - start;
}

/** Length of the comment at `start`, or 0 when no comment starts there. */
function commentLength(sql: string, start: number): number {
  if (sql.startsWith('/*', start)) return blockCommentLength(sql, start);
  if (!sql.startsWith('--', start)) return 0;
  const end = sql.indexOf('\n', start);
  return (end === -1 ? sql.length : end) - start;
}

/**
 * `sql` with every comment replaced by a space, so a statement after `-- note` or `/* note *\/` is still seen.
 * Quoted strings are kept whole, so `'--'` hides nothing. Dollar-quoted bodies (`DO $$ … $$`) are code and
 * are cleaned like the rest.
 */
export function withoutSqlComments(sql: string): string {
  let cleaned = '';
  let index = 0;
  while (index < sql.length) {
    const comment = commentLength(sql, index);
    if (comment > 0) {
      cleaned += ' ';
      index += comment;
      continue;
    }
    const tag = DOLLAR_TAG.exec(sql.slice(index))?.[0];
    const span = tag?.length ?? (sql[index] === "'" ? quotedLength(sql, index) : 1);
    cleaned += sql.slice(index, index + span);
    index += span;
  }
  return cleaned;
}

/** `sql` with every quoted string emptied to `''`, so a comma or parenthesis inside one splits nothing. */
function withEmptyStrings(sql: string): string {
  let emptied = '';
  let index = 0;
  while (index < sql.length) {
    const span = sql[index] === "'" ? quotedLength(sql, index) : 1;
    emptied += span > 1 ? "''" : sql.charAt(index);
    index += span;
  }
  return emptied;
}

/** The arguments of the call whose `(` is at `open`, split at top-level commas and trimmed. Strings are already empty. */
function callArguments(sql: string, open: number): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  for (const char of sql.slice(open + 1)) {
    if (char === ')' && depth === 0) break;
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    current += char;
  }
  return [...args, current.trim()];
}

const SET_CONFIG_CALL = /\bset_config\s*\(/gi;

/** True when a `set_config` call's third argument is anything but the literal `true` (transaction-local). */
export function hasSessionSetConfig(sql: string): boolean {
  const code = withEmptyStrings(sql);
  return [...code.matchAll(SET_CONFIG_CALL)].some((call) => {
    const isLocal = callArguments(code, call.index + call[0].length - 1)[2];
    return isLocal?.toLowerCase() !== 'true';
  });
}
