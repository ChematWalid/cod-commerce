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

describe('plugin dashboards', () => {
  it('hold no physical utility and no colour literal', () => {
    const pluginsDir = join(repoRoot, 'plugins');
    const files = existsSync(pluginsDir) ? collect(pluginsDir) : [];

    expect(findDashboardStyleViolations(files)).toEqual([]);
  });
});
