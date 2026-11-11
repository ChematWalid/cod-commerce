/**
 * Prefixes `sql` with a transaction-local statement timeout. One simple-protocol message runs both statements in
 * one implicit transaction, so `SET LOCAL` holds behind a transaction-mode pooler and ends with the query.
 * Postgres then cancels the query itself when it outlives its budget.
 */
export const withStatementTimeout = (sql: string, timeoutMs: number): string =>
  `SET LOCAL statement_timeout = ${String(Math.ceil(timeoutMs))}; ${sql}`;
