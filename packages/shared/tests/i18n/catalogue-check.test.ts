import { describe, expect, it } from 'vitest';
import { checkCatalogues, formatProblem, usedMessageIds } from '../../scripts/i18n/check-catalogues';
import { SHELL, check, pluginWith, po } from './catalogue-fixtures';

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
