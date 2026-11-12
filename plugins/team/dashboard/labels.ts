import { BUILT_IN_ROLES, type TeamEmailLocale } from '@cod/shared';
import { useLingui } from '@lingui/react';
import type { CommissionBasisDto, RoleOptionDto } from './dto';

/** The display language without its region. */
export function useUiLanguage(): string {
  const { i18n } = useLingui();
  return i18n.locale.split(/[-_]/)[0] ?? i18n.locale;
}

/** The invitation email's language: the inviter's display language when it is one an email is written in. */
export function emailLocaleOf(language: string): TeamEmailLocale {
  return language === 'en' ? 'en' : 'ar';
}

/** A role's name to show: a built-in's stored name is English, so its catalog label is used (French falls back). */
export function roleLabelOf(role: Pick<RoleOptionDto, 'name' | 'builtInKey'>, language: string): string {
  const builtIn = BUILT_IN_ROLES.find((template) => template.key === role.builtInKey);
  if (builtIn === undefined) return role.name;
  return language === 'ar' ? builtIn.label.ar : builtIn.label.en;
}

/** A role named on a member row, labelled through the business's roles when the caller may read them. */
export function memberRoleLabel(
  role: { readonly id: string; readonly name: string },
  options: readonly RoleOptionDto[],
  language: string,
): string {
  const option = options.find((candidate) => candidate.id === role.id);
  return roleLabelOf(option ?? { name: role.name, builtInKey: null }, language);
}

export function basisLabelOf(basis: string, bases: readonly CommissionBasisDto[], language: string): string {
  const option = bases.find((candidate) => candidate.basis === basis);
  if (option === undefined) return basis;
  return language === 'ar' ? option.labels.ar : option.labels.en;
}

/** Names joined as a list of the display language ("A، B" in Arabic, "A, B" otherwise). */
export function listOf(names: readonly string[], language: string): string {
  return names.join(language === 'ar' ? '، ' : ', ');
}

/** Whole DZD with the display language's grouping and Latin digits, as amounts are written in Algeria. */
export function formatDzd(amount: number, language: string): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-DZ' : 'en', { numberingSystem: 'latn' }).format(amount);
}
