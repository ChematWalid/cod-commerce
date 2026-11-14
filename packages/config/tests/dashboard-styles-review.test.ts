import { describe, expect, it } from 'vitest';
import { findDashboardStyleViolations } from '../gates/dashboard-styles';

const violationsOf = (content: string, name = 'x.tsx'): string[] =>
  findDashboardStyleViolations([{ path: `plugins/demo/dashboard/components/${name}`, content }]);
const inCssOf = (content: string): string[] =>
  findDashboardStyleViolations([{ path: 'plugins/demo/dashboard/styles/x.css', content }]);

describe('findDashboardStyleViolations reads every inline style object (P2.S1 task 3 review)', () => {
  it.each([
    '<div style={{ top: `${y}px`, marginLeft: 4 }} />',
    '<div style={{ marginLeft: 4, transform: `translateX(${x}px)` }} />',
    '<div style={{ marginLeft: `${x}px` }} />',
    '<div style={{ right: `calc(${a}px)` }} />',
    'const S = { box: { gap: 1 }, marginLeft: 4 };',
    'const S = { marginLeft: 4, inner: { a: 1 } };',
    '<div style={{ marginLeft: f({ a: 1 }) }} />',
    '<div style={{ ...(rtl && { marginLeft: 4 }) }} />',
    '<div style={cond && { marginLeft: 4 }} />',
    '<div style={{ // why\n marginLeft: 4 }} />',
  ])('flags the physical key in %s', (source) => {
    const violations = violationsOf(source);

    expect(violations).toEqual([expect.stringContaining('physical property')]);
  });

  it('reports each key of a style object on its own', () => {
    const violations = violationsOf('<div style={{ left: 0, right: `${x}px` }} />');

    expect(violations).toEqual([expect.stringContaining('"left: 0"'), expect.stringContaining('"right: `${x}px`"')]);
  });

  it.each([
    'type Insets = { left: number; right: number };',
    'type Pair = { left: number; right: number };',
    'interface Box { marginLeft: number }',
    'function f(p: { left: number }): number { return p.left; }',
    'const f = ({ left: l }: R) => l;',
    'const { marginLeft, right: r } = rect;',
  ])('does not read a type or a binding pattern as a style in %s', (source) => {
    expect(violationsOf(source, 'x.ts')).toEqual([]);
  });

  it('parses a .ts file without JSX, so a <T> cast does not hide a style', () => {
    expect(violationsOf('const S = <Style>{ marginLeft: 4 };', 'x.ts')).toHaveLength(1);
  });

  it.each([
    'border-white',
    'fill-black',
    'ring-white',
    'stroke-black',
    'divide-white',
    'outline-black',
    'shadow-black/50',
    'text-shadow-red-500',
    'drop-shadow-black',
    'bg-[red]',
    'text-[crimson]',
    'text-[color:navy]',
  ])('flags the fixed colour class %s', (utility) => {
    const violations = violationsOf(`<div className="flex ${utility}" />`);

    expect(violations).toEqual([expect.stringContaining('colour literal')]);
  });

  it.each(['bg-[var(--brand)]', 'text-[length:12px]', 'bg-[url(/a.png)]', 'border-[thin]'])(
    'accepts the arbitrary value %s',
    (utility) => {
      expect(violationsOf(`<div className="${utility}" />`)).toEqual([]);
    },
  );

  it('flags each named colour of an inline style', () => {
    const violations = violationsOf("<div style={{ color: 'red', background: 'white', borderColor: `Navy` }} />");

    expect(violations).toEqual([
      expect.stringContaining('"red"'),
      expect.stringContaining('"white"'),
      expect.stringContaining('"Navy"'),
    ]);
  });

  it('accepts inline theme colours and non-colour keys that hold a colour word', () => {
    const source =
      "<div style={{ color: 'var(--foreground)', fill: 'currentColor', fontFamily: 'Tan' }} title='red' />";

    expect(violationsOf(source)).toEqual([]);
  });

  it.each(['a { b { margin: 0 } color: red; }', 'a { COLOR: red; }', 'a { --brand: red; color: var(--brand); }'])(
    'flags the named CSS colour in %s',
    (css) => {
      expect(inCssOf(css)).toEqual([expect.stringContaining('"red"')]);
    },
  );

  it.each([
    'a { background: url(red.png); }',
    'a { background-image: url("/img/white.svg"); }',
    "a { --label: 'red'; --sidebar-width: 16rem; }",
  ])('accepts a colour word inside a url or a string in %s', (css) => {
    expect(inCssOf(css)).toEqual([]);
  });

  it('does not take a call to a function named color for a colour literal', () => {
    expect(violationsOf('const c = color(x);', 'x.ts')).toEqual([]);
    expect(violationsOf('const c = "color(display-p3 1 0 0)";', 'x.ts')).toHaveLength(1);
  });
});
