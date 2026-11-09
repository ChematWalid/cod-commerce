import type { AuthEmailKind, AuthEmailLocale, AuthEmailVars, RenderedEmail } from '../email';

/** Renders the account emails. The server provides it (`apps/server/src/email`), so wording is not in the plugin (D32). */
export interface AuthEmailTemplatesPort {
  /**
   * Values are HTML-escaped; Arabic output is `dir="rtl"`.
   *
   * @throws Error if a variable of the kind is missing or a link is not http(s).
   */
  render(kind: AuthEmailKind, locale: AuthEmailLocale, vars: AuthEmailVars): RenderedEmail;
}
