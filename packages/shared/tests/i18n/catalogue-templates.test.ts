import { describe, expect, it } from 'vitest';
import { checkCatalogues, formatProblem } from '../../scripts/i18n/check-catalogues';
import { SHELL, check, pluginWith, po, withArabic } from './catalogue-fixtures';

const problemsOf = (...args: Parameters<typeof pluginWith>): string[] => check(pluginWith(...args)).map(formatProblem);

describe('checkCatalogues, dotted templates that are not message ids', () => {
  it('reports nothing for a dotted file-name template', () => {
    expect(problemsOf('const src = `media.${id}.webp`;', {})).toEqual([]);
  });

  it('accepts a dotted template declared as a non-message literal', () => {
    const declared = { nonMessageLiterals: ['logo.${ext}'] };

    expect(problemsOf('const src = `logo.${ext}`;', {}, declared)).toEqual([]);
  });

  it('still reports a dotted template whose shape only a declared non-message literal matches', () => {
    const declared = { nonMessageLiterals: ['demo.nav'] };

    expect(problemsOf('const t = `demo.${a}`;', {}, declared)).toEqual(['demo en dynamic demo.${a}']);
  });

  it('accepts a template that builds a permission key when its text is declared', () => {
    const declared = { nonMessageLiterals: ['orders.${verb}'] };

    expect(problemsOf('const key = `orders.${verb}`; hasPermission(key);', {}, declared)).toEqual([]);
  });

  it('reports nothing for a dotted template given straight to a permission call', () => {
    expect(problemsOf('hasPermission(`orders.${verb}`); user.can(`catalog.products.${verb}`);', {})).toEqual([]);
  });

  it('still reports orders.${status} when the catalogue holds orders.* message ids', () => {
    const source = 'const label = `orders.${status}`;';

    expect(problemsOf(source, { 'orders.open': 'Open' })).toEqual(['demo en dynamic orders.${status}']);
  });

  it('still reports catalog.products.${field} beside permission keys and shared shell leaf ids', () => {
    const shell = { ...SHELL, nonMessageLiterals: ['catalog.products', 'orders.all', 'team.members'] };
    const plugin = pluginWith('const k = `catalog.products.${field}`; const t = `team.${s}`;', {});

    expect(checkCatalogues({ plugins: [shell, plugin] }).map(formatProblem)).toEqual([
      'demo en dynamic catalog.products.${field}',
      'demo en dynamic team.${s}',
    ]);
  });

  it('reports nothing for a dotted template in a JSX attribute other than id or message', () => {
    const source = '<div data-testid={`row.${id}`} className={`grid.${size}`} />';

    expect(problemsOf(source, {})).toEqual([]);
  });

  it('still reports a dotted template given as a JSX message', () => {
    expect(problemsOf('<Trans message={`demo.status.${s}`} />', {})).toEqual(['demo en dynamic demo.status.${s}']);
  });

  it('still reports a declared non-message template given to a message call', () => {
    const declared = { nonMessageLiterals: ['logo.${ext}'] };

    expect(problemsOf('i18n._(`logo.${ext}`)', {}, declared)).toEqual(['demo en dynamic logo.${ext}']);
  });
});

describe('checkCatalogues, ids concatenated with +', () => {
  it('reports an id concatenated with + outside dynamic-ids', () => {
    expect(problemsOf(`i18n._('demo.' + status)`, {})).toEqual(['demo en dynamic demo.${status}']);
  });

  it('accepts a concatenated id whose shape a registered dynamic id matches', () => {
    const registered = { dynamicIds: ['demo.open'] };

    expect(problemsOf(`i18n._('demo.' + status)`, { 'demo.open': 'Open' }, registered)).toEqual([]);
  });

  it('reports a concatenated id in a title property or a *_MESSAGE_ID constant', () => {
    const source = `const page = { title: 'demo.' + a }; const X_MESSAGE_ID = 'demo.' + a;`;

    expect(problemsOf(source, {})).toEqual(['demo en dynamic demo.${a}']);
  });

  it('reports a concatenation whose fixed parts hold no dot, whatever dynamic ids are registered', () => {
    const registered = { dynamicIds: ['demo.open'] };

    expect(problemsOf('i18n._(prefix + key)', { 'demo.open': 'Open' }, registered)).toEqual([
      'demo en dynamic ${prefix}${key}',
    ]);
  });

  it('reports nothing for a title built with + from display text', () => {
    const source = `const page = { title: name + ' – Settings' }; const PAGE_TITLE = name + ' | Shop';`;

    expect(problemsOf(source, {})).toEqual([]);
  });

  it("still reports 'demo.' + s in a title", () => {
    expect(problemsOf(`const PAGE_TITLE = 'demo.' + s;`, {})).toEqual(['demo en dynamic demo.${s}']);
  });

  it('reports a dotted + chain held in a variable', () => {
    const source = `const k = 'demo.status.' + s; i18n._(k);`;

    expect(problemsOf(source, {})).toEqual(['demo en dynamic demo.status.${s}']);
  });

  it('reports nothing for a + chain outside a message slot that is display text or a file name', () => {
    const source = `const total = 'Total: ' + n; const src = 'media.' + id + '.webp'; const n2 = a + b;`;

    expect(problemsOf(source, {})).toEqual([]);
  });

  it('reads a template operand of a concatenation as fixed parts and holes', () => {
    const registered = { dynamicIds: ['demo.a.b'] };

    expect(problemsOf("i18n._(`demo.${x}` + '.b')", { 'demo.a.b': 'AB' }, registered)).toEqual([]);
  });
});

describe('checkCatalogues, literal ids in a Trans element', () => {
  it('reports a non-dotted Trans id missing from the Arabic catalogue', () => {
    const plugin = withArabic(pluginWith('<Trans id="Save" />', { Save: 'Save' }), po({}));

    expect(check(plugin).map(formatProblem)).toEqual(['demo ar missing Save']);
  });

  it('reports a non-dotted id in a Trans message expression', () => {
    const plugin = withArabic(pluginWith("<Trans message={'Save'} />", { Save: 'Save' }), po({}));

    expect(check(plugin).map(formatProblem)).toEqual(['demo ar missing Save']);
  });

  it('reports nothing for a DOM id attribute', () => {
    expect(problemsOf('<section id="main"><input id={"email"} /></section>', {})).toEqual([]);
  });
});
