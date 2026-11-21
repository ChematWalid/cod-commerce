/** Shared fixtures of the catalogue-check tests: a `.po` builder, the shell plugin and a one-file plugin. */
import { checkCatalogues, type PluginCatalogueInput } from '../../scripts/i18n/check-catalogues';

/** A `.po` catalogue holding `entries`, with the header Lingui writes. */
export function po(entries: Readonly<Record<string, string>>): string {
  const body = Object.entries(entries).map(([id, text]) => `msgid "${id}"\nmsgstr "${text}"\n`);
  return ['msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=utf-8\\n"\n', ...body].join('\n');
}

export const SHELL: PluginCatalogueInput = {
  plugin: 'merchant-shell',
  sources: [],
  catalogues: {
    en: po({ 'subdomain.taken': 'Taken', 'shell.only': 'Shell' }),
    ar: po({ 'subdomain.taken': 'محجوز', 'shell.only': 'الواجهة' }),
    fr: po({ 'subdomain.taken': 'Pris' }),
  },
};

/** A plugin whose one source file holds `source`, with both catalogues holding `entries`. */
export function pluginWith(
  source: string,
  entries: Readonly<Record<string, string>>,
  extra: Partial<PluginCatalogueInput> = {},
): PluginCatalogueInput {
  return {
    plugin: 'demo',
    sources: [{ path: 'dashboard/page.tsx', text: source }],
    catalogues: { en: po(entries), ar: po(entries) },
    ...extra,
  };
}

export const check = (...plugins: PluginCatalogueInput[]) => checkCatalogues({ plugins: [SHELL, ...plugins] });

/** The plugin's Arabic catalogue replaced by `arabic`, English kept. */
export const withArabic = (plugin: PluginCatalogueInput, arabic: string): PluginCatalogueInput => ({
  ...plugin,
  catalogues: { ...plugin.catalogues, ar: arabic },
});
