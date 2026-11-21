/** What catalog-import logs through: the structured logger in production, a recording fake in tests (§3a.8). */
export interface ImportLogger {
  error(message: string): void;
  warn(message: string): void;
}
