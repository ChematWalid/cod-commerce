import { describe, expect, it } from 'vitest';
import { formatProblem } from '../../scripts/i18n/check-catalogues';
import { check, pluginWith } from './catalogue-fixtures';

const problemsOf = (...args: Parameters<typeof pluginWith>): string[] => check(pluginWith(...args)).map(formatProblem);

describe('checkCatalogues, dotted templates that are not message ids', () => {
  it('reports nothing for a dotted file-name template', () => {
    expect(problemsOf('const src = `media.${id}.webp`;', {})).toEqual([]);
  });

  it('accepts a dotted template declared as a non-message literal', () => {
    const declared = { nonMessageLiterals: ['logo.${ext}'] };

    expect(problemsOf('const src = `logo.${ext}`;', {}, declared)).toEqual([]);
  });

  it('accepts a dotted template whose shape a declared non-message literal matches', () => {
    const declared = { nonMessageLiterals: ['product.row-1'] };

    expect(problemsOf('const row = `product.row-${id}`;', {}, declared)).toEqual([]);
  });

  it('reports nothing for a dotted template that builds a permission key', () => {
    expect(problemsOf('const key = `orders.${verb}`; hasPermission(key);', {})).toEqual([]);
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

  it('reads a template operand of a concatenation as fixed parts and holes', () => {
    const registered = { dynamicIds: ['demo.a.b'] };

    expect(problemsOf("i18n._(`demo.${x}` + '.b')", { 'demo.a.b': 'AB' }, registered)).toEqual([]);
  });
});
