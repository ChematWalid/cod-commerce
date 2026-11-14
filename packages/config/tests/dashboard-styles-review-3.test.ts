import { describe, expect, it } from 'vitest';
import { findDashboardStyleViolations } from '../gates/dashboard-styles';

const violationsOf = (content: string, name = 'x.tsx'): string[] =>
  findDashboardStyleViolations([{ path: `plugins/demo/dashboard/components/${name}`, content }]);
const inCssOf = (content: string): string[] =>
  findDashboardStyleViolations([{ path: 'plugins/demo/dashboard/styles/x.css', content }]);

/** The gate must stay linear on a long unbroken line; the old patterns took seconds here. */
const LINEAR_SCAN_BUDGET_MS = 1000;

describe('findDashboardStyleViolations closes the round-3 bypasses (P2.S1 task 3 review round 3)', () => {
  it.each([
    "<div style={{ 'margin-left': 4 }} />",
    "<div style={{ 'padding-right': x }} />",
    "<div style={{ 'border-top-left-radius': r }} />",
    "<div style={{ background: 'linear-gradient(to left, var(--a), var(--b))' }} />",
    "<div style={{ justifyContent: 'left' }} />",
    "<div style={{ justifySelf: 'safe right' }} />",
  ])('flags the physical inline declaration in %s', (source) => {
    expect(violationsOf(source)).toEqual([expect.stringContaining('physical property')]);
  });

  it.each([
    '.a { background: linear-gradient(to right, var(--a), var(--b)); }',
    '.a { background-image: linear-gradient(to top left, var(--a), var(--b)); }',
    '.a { mask-image: repeating-linear-gradient(to right, var(--a), transparent); }',
    '.a { background: url(a.png) no-repeat left center; }',
    '.a { mask: url(m.svg) right / contain; }',
    '.a { justify-content: left; }',
    '.a { justify-content: safe left; }',
    '.a { justify-items: legacy right; }',
    '.a { justify-self: right; }',
    '.a { text-align-last: right; }',
  ])('flags the physical CSS declaration in %s', (css) => {
    expect(inCssOf(css)).toEqual([expect.stringContaining('physical property')]);
  });

  it.each([
    '.a { background: linear-gradient(to bottom, var(--a), var(--b)); }',
    '.a { background: url(left.png) no-repeat center; }',
    '.a { background: url("right.png") center / cover; }',
    '.a { justify-content: space-between; justify-self: start; text-align-last: end; }',
  ])('accepts the direction-free CSS declaration in %s', (css) => {
    expect(inCssOf(css)).toEqual([]);
  });

  it.each([
    '<path fill="red" />',
    '<path stroke="white" />',
    "<path fill={'red'} />",
    '<stop stopColor="navy" />',
    "<feFlood floodColor={dark ? 'black' : 'var(--x)'} />",
  ])('flags the named colour in the SVG attribute of %s', (source) => {
    expect(violationsOf(source)).toEqual([expect.stringContaining('colour literal')]);
  });

  it.each([
    '<path fill="currentColor" stroke="none" />',
    '<path fill="var(--primary)" />',
    '<input color="primary" />',
  ])('accepts the theme-driven SVG attribute of %s', (source) => {
    expect(violationsOf(source)).toEqual([]);
  });

  it.each(['.a { color: RGB(1 2 3); }', '.a { color: HSL(1 2% 3%); }', '.a { color: OKLCH(0.5 0.1 20); }'])(
    'flags the colour function in any case in %s',
    (css) => {
      expect(inCssOf(css)).toEqual([expect.stringContaining('colour literal')]);
    },
  );

  it('flags a colour function in any case inside a TSX value', () => {
    expect(violationsOf("<div style={{ color: 'COLOR-MIX(in srgb, var(--a), var(--b))' }} />")).toEqual([
      expect.stringContaining('colour literal'),
    ]);
  });

  it.each([
    'let left = 0; ({ a: { left } } = r);',
    'let left = 0; [{ left }] = arr;',
    'let left = 0; [...[{ left }]] = arr;',
    'let left = 0; for ({ left } of rects) use(left);',
    'const props = { leftIcon: icon, rightSlot: slot, onLeftClick: go };',
  ])('accepts the nested destructuring target or non-CSS key in %s', (source) => {
    expect(violationsOf(source)).toEqual([]);
  });

  it('still flags a style object assigned into a destructured slot', () => {
    expect(violationsOf('let s; ({ s } = { s: { marginLeft: 4 } }); x = [{ paddingRight: 2 }];')).toHaveLength(2);
  });

  it.each([
    ['class names', `const s = "${'[a'.repeat(50_000)}";`],
    ['arbitrary properties', `const s = "${'[a:'.repeat(50_000)}";`],
  ])('scans a long unbroken line of %s in linear time', (_, source) => {
    const started = performance.now();

    findDashboardStyleViolations([{ path: 'plugins/demo/dashboard/components/x.tsx', content: source }]);

    expect(performance.now() - started).toBeLessThan(LINEAR_SCAN_BUDGET_MS);
  });
});
