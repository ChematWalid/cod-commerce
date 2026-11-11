import { hasSessionSetConfig } from './sql-text';

/** One kind of session-scoped SQL the gate refuses. */
export interface ForbiddenSqlRule {
  readonly rule: string;
  readonly matches: (sql: string) => boolean;
}

/** Where a statement can start: the text's start, after `;`, `BEGIN`, a dollar quote, or a quote (`EXECUTE '…'`). */
const START = String.raw`(?:^|;|\bBEGIN\b|\$\w*\$|')\s*`;
/** A name: plain, dotted, quoted, or a template hole. */
const NAME = String.raw`(?:"[^"]*"|[\w$.]+)`;
/** What may follow a statement's last word. */
const END = String.raw`\s*(?:;|$|')`;

const pattern = (source: string): RegExp => new RegExp(source, 'i');

/** `SET <keyword> …` forms, each with the argument shape SQL gives it, so prose like "Set session timeout" passes. */
const SET_KEYWORD_FORMS = [
  String.raw`SESSION\s+(?:AUTHORIZATION|CHARACTERISTICS)\b`,
  String.raw`ROLE\s*(?:'|"|\w+${END})`,
  String.raw`(?:SCHEMA|NAMES)\s*'`,
  String.raw`TIME\s+ZONE\s*(?:'|LOCAL\b|DEFAULT\b|INTERVAL\b|[+-]?\d)`,
  String.raw`XML\s+OPTION\s+(?:DOCUMENT|CONTENT)\b`,
].join('|');

/** `SET [SESSION] <name> = …` (any case), or `… TO …` with a dotted or snake_case name; never `SET LOCAL`. */
const SET_ASSIGNMENT = String.raw`(?:SESSION\s+)?(?!LOCAL\s)(?:${NAME}\s*=|(?:"[^"]*"|[\w$]*[._][\w$.]*)\s+TO\b)`;

/** `SET <name> TO …` with a plain name, in one letter case only: "Set status to active" is prose. */
const SET_TO_UPPER = /(?:^|;|\bBEGIN\b|\$\w*\$|')\s*SET\s+(?!LOCAL\s)[\w"]+\s+TO\b/;
const SET_TO_LOWER = /(?:^|;|\bbegin\b|\$\w*\$|')\s*set\s+(?!local\s)[\w"]+\s+to\b/;

const SESSION_SET = pattern(String.raw`${START}SET\s+(?:${SET_KEYWORD_FORMS}|${SET_ASSIGNMENT})`);

const TEMP = String.raw`(?:(?:GLOBAL|LOCAL)\s+)?(?:TEMP|TEMPORARY)\s+(?:UNLOGGED\s+)?`;
const TEMP_TABLE = pattern(
  String.raw`\bCREATE\s+${TEMP}TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${NAME}\s*(?:\(|AS\b|ON\b|;|$)(?![^;']*\bON\s+COMMIT\s+DROP\b)`,
);
const TEMP_OTHER = pattern(
  String.raw`\bCREATE\s+(?:OR\s+REPLACE\s+)?${TEMP}(?:RECURSIVE\s+)?(?:VIEW|SEQUENCE)\s+${NAME}`,
);
const TEMP_SCHEMA = /\bpg_temp\s*\./i;
const SELECT_INTO_TEMP = pattern(String.raw`\bINTO\s+${TEMP}(?:TABLE\s+)?${NAME}`);

/**
 * PgBouncer hands a backend to the next client between transactions, so session state crosses tenants (ADR 0016
 * §6). Keywords match in any letter case; each rule needs SQL shape (an assignment, a name then `AS`, a
 * statement end), so prose such as "Set your subdomain" or "Listen to the webhook" passes.
 */
export const FORBIDDEN_SQL: readonly ForbiddenSqlRule[] = [
  { rule: 'session-set', matches: (sql) => [SESSION_SET, SET_TO_UPPER, SET_TO_LOWER].some((re) => re.test(sql)) },
  { rule: 'session-set-config', matches: hasSessionSetConfig },
  { rule: 'session-advisory-lock', matches: (sql) => /\bpg_(?:try_)?advisory_lock(?:_shared)?\s*\(/i.test(sql) },
  { rule: 'listen', matches: (sql) => pattern(String.raw`${START}LISTEN\s+${NAME}${END}`).test(sql) },
  {
    rule: 'temporary-table',
    matches: (sql) => [TEMP_TABLE, TEMP_OTHER, TEMP_SCHEMA, SELECT_INTO_TEMP].some((re) => re.test(sql)),
  },
  {
    rule: 'prepared-statement',
    matches: (sql) => pattern(String.raw`${START}PREPARE\s+${NAME}\s*(?:\(|AS\b)`).test(sql),
  },
  {
    rule: 'cursor-with-hold',
    matches: (sql) => pattern(String.raw`\bDECLARE\s+${NAME}\b[^;]*\bWITH\s+HOLD\b`).test(sql),
  },
];
