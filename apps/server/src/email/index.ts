import type {
  AuthEmailKind,
  AuthEmailLocale,
  AuthEmailTemplatesPort,
  AuthEmailVars,
  RenderedEmail,
} from '@cod/plugin-auth';
import { renderEmailChangeConfirm } from './email-change-confirm';
import { renderEmailChangeNotice } from './email-change-notice';
import { renderPasswordChanged } from './password-changed';
import { renderPasswordReset } from './password-reset';
import { renderProviderLinked } from './provider-linked';
import { renderVerification } from './verification';

type Renderer = (locale: AuthEmailLocale, vars: AuthEmailVars) => RenderedEmail;

/** One renderer per kind: a new kind is a new entry, not a new branch. */
const RENDERERS: Readonly<Record<AuthEmailKind, Renderer>> = {
  verification: renderVerification,
  'password-reset': renderPasswordReset,
  'email-change-confirm': renderEmailChangeConfirm,
  'email-change-notice': renderEmailChangeNotice,
  'password-changed': renderPasswordChanged,
  'provider-linked': renderProviderLinked,
};

/** The wording of the account emails in Arabic and English (D32), injected into `AuthPlugin.init`. */
export const authEmailTemplates: AuthEmailTemplatesPort = {
  render: (kind, locale, vars) => RENDERERS[kind](locale, vars),
};
