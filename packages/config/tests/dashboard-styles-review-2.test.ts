import { describe, expect, it } from 'vitest';
import { findDashboardStyleViolations } from '../gates/dashboard-styles';

const violationsOf = (content: string, name = 'x.tsx'): string[] =>
  findDashboardStyleViolations([{ path: `plugins/demo/dashboard/components/${name}`, content }]);
const inCssOf = (content: string): string[] =>
  findDashboardStyleViolations([{ path: 'plugins/demo/dashboard/styles/x.css', content }]);
const inClassOf = (utility: string): string[] => violationsOf(`<div className="flex ${utility}" />`);

describe('findDashboardStyleViolations reads every form of an inline style (P2.S1 task 3 review round 2)', () => {
  it.each([
    'const marginLeft = 4; const e = <div style={{ marginLeft }} />;',
    "<div style={{ ['marginLeft']: 4 }} />",
    '<div style={{ [`paddingRight`]: 4 }} />',
    "<div style={{ WebkitBorderLeft: '1px solid var(--border)' }} />",
    '<div style={{ MarginLeft: 4 }} />',
    "<div style={{ textAlign: 'right' as const }} />",
    "const S = { float: 'left' as const };",
    "<div style={{ textAlign: cond ? 'left' : 'start' }} />",
    "<div style={{ textAlign: (rtl ? 'start' : 'right') satisfies string }} />",
    "<div style={{ clear: side ?? 'left' }} />",
    "<div style={{ margin: '0 1px 0 2px' }} />",
    "<div style={{ borderRadius: '1px 2px 3px 4px' }} />",
    "<div style={{ backgroundPosition: 'left' }} />",
    "<div style={{ transformOrigin: 'left top' }} />",
  ])('flags the physical declaration in %s', (source) => {
    expect(violationsOf(source)).toEqual([expect.stringContaining('physical property')]);
  });

  it.each([
    "<div style={{ color: 'red' as const }} />",
    "const S = { color: ('red') };",
    "<div style={{ color: ok ? 'var(--x)' : 'red' }} />",
    "<div style={{ background: x || 'white' }} />",
  ])('flags the named colour in %s', (source) => {
    expect(violationsOf(source)).toEqual([expect.stringContaining('colour literal')]);
  });

  it.each([
    "<div style={{ margin: '0 1px 0 1px', padding: '1px 2px', inset: '0 4px' }} />",
    "<div style={{ borderRadius: '4px 4px 2px 2px', backgroundPosition: 'center top' }} />",
    "const m = defineMessages({ left: { id: 'a' }, right: { id: 'b' } });",
    'let left = 0; ({ left } = rect);',
  ])('accepts the mirrored or non-style object in %s', (source) => {
    expect(violationsOf(source)).toEqual([]);
  });
});

describe('findDashboardStyleViolations reads CSS declarations in any case and form (task 3 review round 2)', () => {
  it.each([
    '.a { MARGIN-LEFT: 4px; }',
    '.a { Text-Align: right; }',
    '.a { margin: 0 1px 0 2px; }',
    '.a { inset: 0 1px 0 2px; }',
    '.a { border-radius: 1px 2px 3px 4px; }',
    '.a { background-position: left top; }',
    '.a { transform-origin: left; }',
    '.a { -webkit-mask-position: right; }',
  ])('flags the physical declaration in %s', (css) => {
    expect(inCssOf(css)).toEqual([expect.stringContaining('physical property')]);
  });

  it('accepts mirrored shorthands, centred positions and selectors', () => {
    const css =
      '.a { margin: 0 1px 0 1px; padding: 1px 2px; border-radius: 4px; transform-origin: center; }\n' +
      'svg.lucide-chevron-left:hover { color: var(--x); }';

    expect(inCssOf(css)).toEqual([]);
  });
});

describe('findDashboardStyleViolations reads Tailwind 4.3.5 direction and colour utilities (task 3 review round 2)', () => {
  it.each([
    'bg-linear-to-r',
    'bg-gradient-to-tl',
    'origin-left',
    'origin-top-right',
    'object-left',
    'bg-right-top',
    'mask-l-from-50%',
    'mask-right',
    '[margin-left:4px]',
    'md:[text-align:right]',
  ])('flags the physical utility %s', (utility) => {
    expect(inClassOf(utility)).toEqual([expect.stringContaining('physical')]);
  });

  it.each([
    'bg-linear-to-b',
    'origin-center',
    'object-top',
    'bg-center',
    'mask-t-from-50%',
    'rtl:[margin-left:4px]',
    '[margin-inline-start:4px]',
  ])('accepts the logical or direction-free utility %s', (utility) => {
    expect(inClassOf(utility)).toEqual([]);
  });

  it.each([
    'border-bs-white',
    'border-be-red-500',
    'mask-t-from-black',
    '[color:red]',
    '[background:1px_solid_white]',
    'rtl:[color:red]',
  ])('flags the fixed colour %s', (utility) => {
    expect(inClassOf(utility)).toEqual([expect.stringContaining('colour literal')]);
  });
});
