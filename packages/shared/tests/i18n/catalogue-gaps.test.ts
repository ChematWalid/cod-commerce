import { describe, expect, it } from 'vitest';
import { formatProblem, type PluginCatalogueInput } from '../../scripts/i18n/check-catalogues';
import { check, pluginWith, po, withArabic } from './catalogue-fixtures';

describe('checkCatalogues, the shapes the first gate missed (#124)', () => {
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

describe('checkCatalogues, review round 1 of #124', () => {
  const MISSING_FALLBACK = [{ plugin: 'demo', locale: 'ar', kind: 'missing', id: 'Fallback' }];

  it.each([
    ['||', `i18n._(label || 'Fallback')`],
    ['&&, its right operand', `i18n._(flag && 'Fallback')`],
    ['satisfies', `i18n._('Fallback' satisfies string)`],
    ['a non-null assertion', `i18n._(('Fallback')!)`],
    ['a nested conditional', `i18n._(a ? 'Other' : b ? 'Fallback' : 'Other')`],
  ])('reports a non-dotted id passed through %s', (_operator, source) => {
    const plugin = withArabic(pluginWith(source, { Fallback: 'Fallback', Other: 'Other' }), po({ Other: 'آخر' }));

    expect(check(plugin)).toEqual(MISSING_FALLBACK);
  });

  it.each([
    ['a title property', `const page = { title: flag ? 'Fallback' : 'Other' };`],
    ['a *_TITLE constant', `const PAGE_TITLE = flag ? 'Other' : 'Fallback';`],
  ])('reports a non-dotted id a conditional chooses in %s', (_place, source) => {
    const plugin = withArabic(pluginWith(source, { Fallback: 'Fallback', Other: 'Other' }), po({ Other: 'آخر' }));

    expect(check(plugin)).toEqual(MISSING_FALLBACK);
  });

  it('reports a template id with no fixed part, whatever dynamic ids are registered', () => {
    const entries = { 'demo.status.active': 'Active' };
    const plugin = pluginWith('i18n._(`${key}`)', entries, { dynamicIds: ['demo.status.active'] });

    expect(check(plugin).map(formatProblem)).toEqual(['demo en dynamic ${key}']);
  });

  it('reports a template id whose fixed parts hold no dot', () => {
    const entries = { 'demo.status.active': 'Active' };
    const plugin = pluginWith('i18n._(`${prefix}${suffix}`)', entries, { dynamicIds: ['demo.status.active'] });

    expect(check(plugin).map(formatProblem)).toEqual(['demo en dynamic ${prefix}${suffix}']);
  });

  it.each([
    ['held in a variable', 'const key = `demo.status.${s}`; i18n._(key);'],
    ['returned by a builder', 'function idOf(s: string) { return `demo.status.${s}`; }'],
    ['given as a JSX id', '<Trans id={`demo.status.${s}`} />'],
    ['in a tagged template', 'i18n._(msg`demo.status.${s}`)'],
  ])('reports a dotted template id built outside the message call, %s', (_shape, source) => {
    expect(check(pluginWith(source, {})).map(formatProblem)).toEqual(['demo en dynamic demo.status.${s}']);
  });

  it('accepts display text built with a template in a title property or a *_TITLE constant', () => {
    const source = 'const x = { title: `${name} – Settings` }; const PAGE_TITLE = `${name} – Orders`;';

    expect(check(pluginWith(source, {}))).toEqual([]);
  });

  it('reports one template used twice once', () => {
    const source = 'i18n._(`demo.s.${a}`); i18n._(`demo.s.${a}`);';

    expect(check(pluginWith(source, {})).map(formatProblem)).toEqual(['demo en dynamic demo.s.${a}']);
  });

  it('reports a nested ICU Arabic plural block that lacks a category', () => {
    const inner = '{b, plural, one {} other {}}';
    const arabic = `{a, plural, zero {} one {} two {} few {} many {} other {${inner}}}`;
    const plugin = pluginWith(`i18n._('demo.count')`, { 'demo.count': arabic });

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'plural', id: 'demo.count' }]);
  });

  it('reports a sparse gettext Arabic plural, its skipped forms read as blank', () => {
    const entry = 'msgid "demo.item"\nmsgid_plural "demo.items"\nmsgstr[0] "عنصر"\nmsgstr[5] "عناصر"\n';
    const plugin = withArabic(pluginWith(`i18n._('demo.item')`, { 'demo.item': 'Item' }), `${po({})}\n${entry}`);

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'plural', id: 'demo.item' }]);
  });

  it('reads a fuzzy flag that follows the previous entry with no blank line as the next entry only', () => {
    const entries = 'msgid "demo.a"\nmsgstr "أ"\n#, fuzzy\nmsgid "demo.b"\nmsgstr "ب"\n';
    const source = `i18n._('demo.a'); i18n._('demo.b');`;
    const plugin = withArabic(pluginWith(source, { 'demo.a': 'A', 'demo.b': 'B' }), `${po({})}\n${entries}`);

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'fuzzy', id: 'demo.b' }]);
  });

  it.each([
    ['flattens', '{count} طلبات'],
    ['rewrites as a select', '{count, select, one {طلب} other {طلبات}}'],
  ])('reports an Arabic translation that %s an English ICU plural', (_shape, arabic) => {
    const english = '{count, plural, one {# order} other {# orders}}';
    const plugin = withArabic(
      pluginWith(`i18n._('demo.orders')`, { 'demo.orders': english }),
      po({ 'demo.orders': arabic }),
    );

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'plural', id: 'demo.orders' }]);
  });

  it('reports an Arabic entry without msgid_plural for an English gettext plural', () => {
    const english = 'msgid "demo.item"\nmsgid_plural "demo.items"\nmsgstr[0] "Item"\nmsgstr[1] "Items"\n';
    const plugin: PluginCatalogueInput = {
      plugin: 'demo',
      sources: [{ path: 'dashboard/page.tsx', text: `i18n._('demo.item')` }],
      catalogues: { en: `${po({})}\n${english}`, ar: po({ 'demo.item': 'عنصر' }) },
    };

    expect(check(plugin)).toEqual([{ plugin: 'demo', locale: 'ar', kind: 'plural', id: 'demo.item' }]);
  });
});
