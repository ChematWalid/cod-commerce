import { BUILT_IN_ROLES, type LocalizedLabel } from '@cod/shared';
import { useLingui } from '@lingui/react';

/** The display language without its region. */
export function useUiLanguage(): string {
  const { i18n } = useLingui();
  return i18n.locale.split(/[-_]/)[0] ?? i18n.locale;
}

/** The label in the display language; French falls back to English (D72). */
export function labelIn(label: LocalizedLabel, language: string): string {
  if (language === 'ar') return label.ar;
  if (language === 'fr') return label.fr ?? label.en;
  return label.en;
}

/** A role's name to show: a built-in's stored name is English, so its catalog label is used instead. */
export function roleNameIn(
  role: { readonly name: string; readonly builtInKey: string | null },
  language: string,
): string {
  const builtIn = BUILT_IN_ROLES.find((template) => template.key === role.builtInKey);
  return builtIn === undefined ? role.name : labelIn(builtIn.label, language);
}
