import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SourceFile } from '../gates/branding';
import { findDashboardStyleViolations } from '../gates/dashboard-styles';

const repoRoot = resolve(__dirname, '../../..');
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.next', '.turbo', 'coverage']);

const collect = (dir: string): SourceFile[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : collect(path);
    return [{ path: relative(repoRoot, path), content: readFileSync(path, 'utf8') }];
  });

const inDashboard = (content: string, name = 'x.tsx'): SourceFile => ({
  path: `plugins/demo/dashboard/components/${name}`,
  content,
});
const violationsOf = (content: string, name?: string): string[] =>
  findDashboardStyleViolations([inDashboard(content, name)]);
const inCssOf = (content: string): string[] =>
  findDashboardStyleViolations([{ path: 'plugins/demo/dashboard/styles/x.css', content }]);

describe('findDashboardStyleViolations', () => {
  it.each([
    'ml-2',
    'mr-2',
    'pl-4',
    'pr-4',
    'left-0',
    'right-0',
    'text-left',
    'text-right',
    'rounded-l-md',
    'rounded-r-md',
    'border-l-2',
    'border-r-2',
    '-ml-2',
    'md:pl-4',
    'hover:dark:text-left',
  ])('flags the physical utility %s', (utility) => {
    expect(violationsOf(`<div className="flex ${utility} gap-2" />`)).toHaveLength(1);
  });

  it.each([
    '#fff',
    '#1a2B3c',
    '#12345678',
    'rgb(0 0 0)',
    'rgba(0, 0, 0, .5)',
    'hsl(10 20% 30%)',
    'bg-white',
    'bg-black',
    'text-white',
    'text-black',
    'dark:bg-white',
  ])('flags the colour literal %s', (literal) => {
    const violations = violationsOf(`const x = "flex ${literal}";`);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('colour literal');
  });

  it.each(['ms-2', 'me-2', 'ps-4', 'pe-4', 'start-0', 'end-0', 'text-start', 'text-end', 'rounded-s-md', 'border-s-2'])(
    'accepts the logical utility %s',
    (utility) => {
      expect(violationsOf(`<div className="${utility}" />`)).toEqual([]);
    },
  );

  it('accepts theme tokens, icons and words that only look physical', () => {
    const source = `
      <div className="bg-background text-foreground border-border" />
      <ChevronLeft className="size-4 rtl:rotate-180" />
      const tooltipLeft = formal-left; // 'html-left' is no utility; text may say left-to-right or right-to-left
    `;

    expect(violationsOf(source)).toEqual([]);
  });

  it('does not count an rtl: or ltr: variant as a physical use', () => {
    expect(violationsOf('<i className="rtl:ml-2 ltr:mr-2 md:rtl:pl-1" />')).toEqual([]);
  });

  it('checks CSS files too', () => {
    const css = findDashboardStyleViolations([
      { path: 'plugins/demo/dashboard/styles/x.css', content: 'a { color: #abc; }' },
    ]);

    expect(css).toHaveLength(1);
  });

  const inCss = (content: string, path = 'plugins/demo/dashboard/styles/x.css'): string[] =>
    findDashboardStyleViolations([{ path, content }]);

  it.each([
    'margin-left: 1px',
    'margin-right: 1px',
    'padding-left: 1px',
    'padding-right: 1px',
    'left: 0',
    'right: 0',
    'border-left: 1px solid',
    'border-right-width: 1px',
    'border-top-left-radius: 2px',
    'scroll-margin-left: 1px',
    'text-align: left',
    'text-align: right',
    'float: left',
  ])('flags the physical CSS property in "%s"', (declaration) => {
    const violations = inCss(`a {\n  ${declaration};\n}`);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('physical property');
  });

  it('accepts logical CSS properties, and selectors and comments that only name a side', () => {
    const css = [
      '/* pinned to the physical left: */',
      "html[dir='rtl'] svg.lucide-chevron-left:not([class*='rtl:']) { scale: -1 1; }",
      'a { margin-inline-start: 1px; padding-inline: 1px 2px; inset-inline-start: 0; text-align: start; }',
    ].join('\n');

    expect(inCss(css)).toEqual([]);
  });

  it("allows only the shell's reset of the stock marker's left, and only in rtl.css", () => {
    const rtl = 'plugins/merchant-shell/dashboard/styles/rtl.css';

    expect(inCss('a::before { left: auto; inset-inline-start: 0; }', rtl)).toEqual([]);
    expect(inCss('a::before { left: 0; }', rtl)).toHaveLength(1);
    expect(inCss('a::before { left: auto; }')).toHaveLength(1);
  });

  it('flags a physical utility used as a class selector in CSS', () => {
    expect(inCss('.ml-2 { color: inherit; }')).toHaveLength(1);
  });

  it.each(['[&_.item]:ml-2', '[&:has(.x)]:pl-4', 'has-[.open]:mr-1', '[@media(min-width:40rem)]:text-left'])(
    'flags a physical utility behind the arbitrary variant %s',
    (token) => {
      expect(violationsOf(`<div className="${token}" />`)).toHaveLength(1);
    },
  );

  it('ignores an in-page link that looks like a hex colour', () => {
    expect(violationsOf(`<a href="#add">x</a><a href='#fab'>y</a>`)).toEqual([]);
  });

  it('reports every match, not just the first', () => {
    const violations = violationsOf('<i className="ml-2 pr-4 bg-white text-black" />');

    expect(violations).toHaveLength(4);
    expect(violations.join('\n')).toContain('"pr-4"');
    expect(violations.join('\n')).toContain('"text-black"');
  });

  it('ignores files outside a plugin dashboard and other extensions', () => {
    const files: SourceFile[] = [
      { path: 'plugins/demo/api/x.ts', content: 'ml-2 #fff' },
      { path: 'plugins/demo/dashboard/i18n/en.po', content: 'msgid "ml-2 #fff"' },
      { path: 'apps/storefront/x.tsx', content: 'ml-2' },
    ];

    expect(findDashboardStyleViolations(files)).toEqual([]);
  });

  it('reports both rules for one file', () => {
    expect(violationsOf('<i className="ml-2 bg-white" />')).toHaveLength(2);
  });
});

describe('findDashboardStyleViolations closes the SHELL-4 bypasses (#125)', () => {
  it.each([
    'float-left',
    'clear-right',
    'rounded-l',
    'rounded-r',
    'rounded-tl-md',
    'rounded-br',
    'border-l',
    'border-r',
    'scroll-ml-2',
    'scroll-pr-4',
  ])('flags the physical utility %s', (utility) => {
    const violations = violationsOf(`<div className="flex ${utility} gap-2" />`);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('physical utility');
  });

  it.each(['bg-red-500', 'text-slate-700', 'border-gray-200', 'ring-blue-500/50', 'hover:fill-emerald-50'])(
    'flags the palette colour class %s',
    (utility) => {
      const violations = violationsOf(`<div className="flex ${utility}" />`);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('colour literal');
    },
  );

  it.each(['oklch(0.5 0.1 20)', 'oklab(0.5 0.1 0.1)', 'lab(50% 40 59)', 'lch(52% 72 56)', 'hwb(10 20% 30%)'])(
    'flags the colour function %s',
    (literal) => {
      expect(violationsOf(`const x = "${literal}";`)).toHaveLength(1);
    },
  );

  it('flags color-mix()', () => {
    const violations = violationsOf('const x = "color-mix(in srgb, var(--primary) 50%, transparent)";');

    expect(violations).toEqual([expect.stringContaining('"color-mix("')]);
  });

  it.each(['color: red', 'background: white', 'border: 1px solid rebeccapurple', 'outline-color: Navy'])(
    'flags the named CSS colour in "%s"',
    (declaration) => {
      const violations = inCssOf(`a {\n  ${declaration};\n}`);

      expect(violations).toHaveLength(1);
      expect(violations[0]).toContain('colour literal');
    },
  );

  it('accepts theme colours, transparent and currentColor in CSS', () => {
    const css = 'a { color: var(--foreground); background: transparent; border-color: currentColor; }';

    expect(inCssOf(css)).toEqual([]);
  });

  it.each([
    '<div style={{ marginLeft: 4 }} />',
    "<div style={{ textAlign: 'right' }} />",
    "<div style={{ paddingRight: '1rem' }} />",
    '<div style={{ left: 0 }} />',
    '<div style={{ borderLeftWidth: 1 }} />',
    "<div style={{ float: 'left' }} />",
    'const BOX_STYLE = { gap: 4, right: 0 } as const;',
  ])('flags the physical inline style in %s', (source) => {
    const violations = violationsOf(source);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('physical property');
  });

  it.each([
    '<div className="rounded-s-md border-s space-x-2 divide-x rounded-lg border-ring rounded-t-md" />',
    '<bdi dir="ltr" style={{ direction: \'ltr\' }} />',
    "const JSON_STYLE = { direction: 'ltr', textAlign: 'left' } as const;",
    "const LTR_STYLE = { direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' } as const;",
    "<div style={{ marginInlineStart: 4, textAlign: 'start', float: 'none' }} />",
    'const sameSet = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length;',
    'const side = isOpen ? left : right;',
    'function Pair(): null { const f = (left: number, right: number): number => left + right; return null; }',
    '<div className="scroll-ms-2 float-start clear-end rounded-ss-md border-x" />',
    'const accent = "var(--color-primary)"; const css = "a { color: var(--red); }";',
  ])('accepts %s', (source) => {
    expect(violationsOf(source)).toEqual([]);
  });
});

/** The whole-repo scan parses every dashboard file; dashboards grow and CI runners are loaded. */
const REPO_SCAN_TIMEOUT_MS = 30_000;

describe('plugin dashboards', () => {
  it(
    'hold no physical utility and no colour literal',
    () => {
      const pluginsDir = join(repoRoot, 'plugins');
      const files = existsSync(pluginsDir) ? collect(pluginsDir) : [];

      expect(findDashboardStyleViolations(files)).toEqual([]);
    },
    REPO_SCAN_TIMEOUT_MS,
  );
});
