import { describe, expect, it } from 'vitest';
import {
  checkCatalogues,
  formatProblem,
  usedMessageIds,
  type PluginCatalogueInput,
} from '../../scripts/i18n/check-catalogues';

/** A `.po` catalogue holding `entries`, with the header Lingui writes. */
function po(entries: Readonly<Record<string, string>>): string {
  const body = Object.entries(entries).map(([id, text]) => `msgid "${id}"\nmsgstr "${text}"\n`);
  return ['msgid ""\nmsgstr ""\n"Content-Type: text/plain; charset=utf-8\\n"\n', ...body].join('\n');
}

const SHELL: PluginCatalogueInput = {
  plugin: 'merchant-shell',
  sources: [],
  catalogues: {
    en: po({ 'subdomain.taken': 'Taken', 'shell.only': 'Shell' }),
    ar: po({ 'subdomain.taken': 'محجوز', 'shell.only': 'الواجهة' }),
    fr: po({ 'subdomain.taken': 'Pris' }),
  },
};

/** A plugin whose one source file holds `source`, with both catalogues holding `entries`. */
function pluginWith(
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

const check = (...plugins: PluginCatalogueInput[]) => checkCatalogues({ plugins: [SHELL, ...plugins] });

describe('checkCatalogues', () => {
  it('reports nothing for a clean plugin', () => {
    const source = `export const TITLE = i18n._('demo.title');\nconst x = { titleId: 'demo.nav' };`;

    expect(check(pluginWith(source, { 'demo.title': 'Title', 'demo.nav': 'Nav' }))).toEqual([]);
  });

  it('reports an id used in the dashboard but absent from a catalogue, per locale', () => {
    const plugin = pluginWith(`i18n._('demo.gone')`, {});

    expect(check(plugin).map(formatProblem)).toEqual(['demo en missing demo.gone', 'demo ar missing demo.gone']);
  });

  it('reports an empty translation', () => {
    const plugin = pluginWith(`i18n._('demo.blank')`, { 'demo.blank': 'Blank' });
    const emptyArabic = { ...plugin, catalogues: { ...plugin.catalogues, ar: po({ 'demo.blank': '' }) } };

    expect(check(emptyArabic)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'empty', id: 'demo.blank' }]);
  });

  it('reports a registered dynamic id that no catalogue holds', () => {
    const plugin = pluginWith('', {}, { dynamicIds: ['demo.error-code'] });

    expect(check(plugin).map(formatProblem)).toEqual([
      'demo en missing demo.error-code',
      'demo ar missing demo.error-code',
    ]);
  });

  it('finds a dotted id of a prefix nothing names, as a later plugin would add', () => {
    const plugin = pluginWith(`const MESSAGE = 'billing.plan-expired';`, {}, { plugin: 'billing' });

    expect(check(plugin).map(formatProblem)).toEqual([
      'billing en missing billing.plan-expired',
      'billing ar missing billing.plan-expired',
    ]);
  });

  it('finds a non-dotted id through the call, title and constant forms', () => {
    const source = [
      `i18n._('Welcome back')`,
      `const page = { title: 'Page title' };`,
      `const SAVE_MESSAGE_ID = 'Save';`,
      `const SECURITY_TITLE = 'Security';`,
    ].join('\n');

    expect(usedMessageIds(pluginWith(source, {}))).toEqual(['Welcome back', 'Page title', 'Save', 'Security']);
  });

  it('skips permission keys, import and export specifiers, file names and comments', () => {
    const source = [
      `import './x.css';`,
      `import { a } from './model/tree.ts';`,
      `export { b } from './store.path';`,
      `const icon = 'logo.svg'; const file = 'messages.po';`,
      `const KEY = 'orders.view';`,
      `const lazy = import('./lazy.page');`,
      '/** Reads `document.title` and `me.channels`. */',
    ].join('\n');

    expect(usedMessageIds(pluginWith(source, {}))).toEqual([]);
  });

  it('still checks a permission key passed to the catalogue explicitly', () => {
    expect(usedMessageIds(pluginWith(`i18n._('orders.view')`, {}))).toEqual(['orders.view']);
  });

  it('skips the literals a plugin declares as not being messages', () => {
    const plugin = pluginWith(
      `leaf('orders.all'); const CODE = 'tenancy.name-invalid';`,
      {},
      {
        nonMessageLiterals: ['orders.all', 'tenancy.name-invalid'],
      },
    );

    expect(check(plugin)).toEqual([]);
  });

  it('reports a declared non-message literal that its own catalogue holds as a message id', () => {
    const plugin = pluginWith(
      `i18n._('demo.title')`,
      { 'demo.title': 'Title' },
      { nonMessageLiterals: ['demo.title', 'demo.leaf'] },
    );

    expect(check(plugin).map(formatProblem)).toEqual(['demo en literal demo.title', 'demo ar literal demo.title']);
  });

  it("skips the shell's non-message literals in every plugin, as a leaf id given to registerShellPage", () => {
    const shell = { ...SHELL, nonMessageLiterals: ['team.roles'] };

    expect(checkCatalogues({ plugins: [shell, pluginWith(`registerShellPage('team.roles', page);`, {})] })).toEqual([]);
  });

  it("accepts an id found only in the shell's catalogue", () => {
    expect(check(pluginWith(`i18n._('shell.only')`, {}))).toEqual([]);
  });

  it('asks for subdomain ids in French too, from the shell or the plugin', () => {
    const plugin = pluginWith(`i18n._('subdomain.taken'); i18n._('subdomain.new')`, { 'subdomain.new': 'New' });

    expect(check(plugin).map(formatProblem)).toEqual(['demo fr missing subdomain.new']);
  });

  it('reports an Arabic plural that lacks one of the six categories', () => {
    const plural = '{count, plural, one {# طلب} other {# طلبات}}';
    const plugin = pluginWith(`i18n._('demo.count')`, { 'demo.count': plural });

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'plural', id: 'demo.count' }]);
  });

  it('accepts an Arabic plural with zero, one, two, few, many and other', () => {
    const plural = '{n, plural, zero {لا} one {واحد} two {اثنان} few {# قليلة} many {# كثيرة} other {#}}';
    const plugin = pluginWith(`i18n._('demo.count')`, { 'demo.count': plural });

    expect(check(plugin)).toEqual([]);
  });

  it('reads continuation lines and escapes of a catalogue entry', () => {
    const multiline = 'msgid "demo.long"\nmsgstr ""\n"first \\"part\\" "\n"second"\n';
    const plugin = pluginWith(`i18n._('demo.long')`, {});
    const catalogues = { en: `${po({})}\n${multiline}`, ar: `${po({})}\n${multiline}` };

    expect(check({ ...plugin, catalogues })).toEqual([]);
  });
});

describe('checkCatalogues, the shapes the first gate missed (#124)', () => {
  /** The plugin's Arabic catalogue replaced by `arabic`, English kept. */
  const withArabic = (plugin: PluginCatalogueInput, arabic: string): PluginCatalogueInput => ({
    ...plugin,
    catalogues: { ...plugin.catalogues, ar: arabic },
  });

  it('reports a non-dotted id chosen by a conditional', () => {
    const plugin = withArabic(
      pluginWith(`i18n._(flag ? 'Save' : 'Cancel')`, { Save: 'Save', Cancel: 'Cancel' }),
      po({ Cancel: 'إلغاء' }),
    );

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'missing', id: 'Save' }]);
  });

  it('reports a non-dotted id behind ??', () => {
    const plugin = withArabic(pluginWith(`i18n._((label ?? 'Fallback') as string)`, { Fallback: 'Fallback' }), po({}));

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'missing', id: 'Fallback' }]);
  });

  it('reports a whitespace-only translation', () => {
    const plugin = withArabic(
      pluginWith(`i18n._('demo.blank')`, { 'demo.blank': 'Blank' }),
      po({ 'demo.blank': '   ' }),
    );

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'empty', id: 'demo.blank' }]);
  });

  it('reports a gettext Arabic plural with two of six forms', () => {
    const entry = 'msgid "demo.item"\nmsgid_plural "demo.items"\nmsgstr[0] "عنصر"\nmsgstr[1] "عناصر"\n';
    const plugin = withArabic(pluginWith(`i18n._('demo.item')`, { 'demo.item': 'Item' }), `${po({})}\n${entry}`);

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'plural', id: 'demo.item' }]);
  });

  it('reports an ICU Arabic plural lacking few although "few" appears in text', () => {
    const full = '{a, plural, zero {} one {} two {} few {} many {} other {}}';
    const short = '{b, plural, one {# طلب} other {# طلبات}}';
    const plugin = pluginWith(`i18n._('demo.count')`, { 'demo.count': `${full} ${short}` });

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'plural', id: 'demo.count' }]);
  });

  it('reports a fuzzy entry', () => {
    const fuzzy = '#, fuzzy\nmsgid "demo.title"\nmsgstr "عنوان"\n';
    const plugin = withArabic(pluginWith(`i18n._('demo.title')`, { 'demo.title': 'Title' }), `${po({})}\n${fuzzy}`);

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'fuzzy', id: 'demo.title' }]);
  });

  it('reports a placeholder missing from the Arabic text', () => {
    const plugin = withArabic(
      pluginWith(`i18n._('demo.left')`, { 'demo.left': '{count} left' }),
      po({ 'demo.left': 'متبقي' }),
    );

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'placeholder', id: 'demo.left' }]);
  });

  it('reports a template-literal id with substitutions outside dynamic-ids', () => {
    const plugin = pluginWith('i18n._(`demo.status.${status}`)', {});

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'en', kind: 'dynamic', id: 'demo.status.${status}' }]);
  });

  it('accepts a template-literal id whose shape a registered dynamic id matches', () => {
    const entries = { 'demo.status.active': 'Active' };
    const plugin = pluginWith('i18n._(`demo.status.${status}`)', entries, { dynamicIds: ['demo.status.active'] });

    expect(check(plugin)).toEqual([]);
  });

  it('keeps the plural argument and the words of plural branches out of the placeholder comparison', () => {
    const english = '{count, plural, one {# order for {name}} other {# orders for {name}}}';
    const arabic =
      '{count, plural, zero {لا شيء لـ {name}} one {طلب} two {طلبان} few {#} many {#} other {# لـ {name}}}';
    const plugin = withArabic(
      pluginWith(`i18n._('demo.orders')`, { 'demo.orders': english }),
      po({ 'demo.orders': arabic }),
    );

    expect(check(plugin)).toEqual([]);
  });
});
