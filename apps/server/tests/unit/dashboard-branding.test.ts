import { PRODUCT_NAME } from '@cod/shared';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  brandDashboardHtml,
  DashboardBrandingError,
  dashboardBrandingPlugin,
  ICON_FILE_NAME,
} from '../../src/config/dashboard-branding.vite';

/** The stock `index.html` of `@vendure/dashboard` 3.8.1, copied verbatim: the shape an upgrade must keep. */
const STOCK_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Vendure Admin Dashboard" />
    <meta name="author" content="Vendure" />
</head>
<body>
<div id="app"></div>
<script type="module" src="/src/app/main.jsx"></script>
</body>
</html>
`;

const BASE_PATH = '/dashboard';

/** The stock plugin's rewrite (`vite-plugin-transform-index.js`, 3.8.1), which runs after ours: it strips the base path. */
function stockBaseRewrite(html: string, base: string): string {
  const attribute = new RegExp(`(href|src)=(["'])${base}/?`, 'g');
  return html.replace(attribute, '$1=$2').replace(/<head>/, `<head>\n        <base href="${base}">\n`);
}

describe('brandDashboardHtml', () => {
  it('names no vendor in the description or the author', () => {
    const html = brandDashboardHtml(STOCK_INDEX_HTML, PRODUCT_NAME);
    expect(html).not.toMatch(/vendure/i);
    expect(html).toContain(`<meta name="description" content="${PRODUCT_NAME} merchant dashboard" />`);
    expect(html).toContain(`<meta name="author" content="${PRODUCT_NAME}" />`);
  });

  it('points the icon link at the emitted file and drops the stock PNG', () => {
    const html = brandDashboardHtml(STOCK_INDEX_HTML, PRODUCT_NAME);
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${ICON_FILE_NAME}" />`);
    expect(html).not.toContain('favicon.png');
  });

  it('escapes the product name', () => {
    expect(brandDashboardHtml(STOCK_INDEX_HTML, 'A "B" <C>')).toContain('content="A &quot;B&quot; &lt;C&gt;"');
  });

  it.each([
    ['icon', '<link rel="icon" type="image/png" href="/favicon.png" />'],
    ['description', '<meta name="description" content="Vendure Admin Dashboard" />'],
    ['author', '<meta name="author" content="Vendure" />'],
  ])('fails with a named error when the %s tag is absent', (tag, markup) => {
    const html = STOCK_INDEX_HTML.replace(markup, '');
    expect(() => brandDashboardHtml(html, PRODUCT_NAME)).toThrow(DashboardBrandingError);
    expect(() => brandDashboardHtml(html, PRODUCT_NAME)).toThrow(new RegExp(tag));
  });
});

describe('dashboardBrandingPlugin', () => {
  const plugin = dashboardBrandingPlugin(BASE_PATH);
  const hook = plugin.transformIndexHtml;
  const run = (html: string): string => hook.handler(html);

  it('runs before the stock rewrite, explicitly', () => {
    expect(hook.order).toBe('pre');
  });

  it('puts the base path on the icon href, so the stock rewrite leaves the file name relative to <base>', () => {
    const branded = run(STOCK_INDEX_HTML);
    expect(branded).toContain(`href="${BASE_PATH}/${ICON_FILE_NAME}"`);
    const rewritten = stockBaseRewrite(branded, BASE_PATH);
    expect(rewritten).toContain(`<base href="${BASE_PATH}">`);
    expect(rewritten).toContain(`href="${ICON_FILE_NAME}"`);
  });

  it('emits our icon as an SVG asset with that file name', () => {
    const emitted: { fileName?: string; source?: string | Uint8Array }[] = [];
    const generate = plugin.generateBundle as (this: unknown) => void;
    generate.call({ emitFile: (file: (typeof emitted)[number]) => emitted.push(file) });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.fileName).toBe(ICON_FILE_NAME);
    const svg = Buffer.from(emitted[0]?.source ?? '').toString('utf8');
    expect(svg).toMatch(/^<svg /);
    expect(svg).not.toMatch(/vendure/i);
  });

  it("removes the framework's PNG that the package's public folder copies into the build", () => {
    const outDir = mkdtempSync(join(tmpdir(), 'cod-branding-'));
    try {
      writeFileSync(join(outDir, 'favicon.png'), 'png');
      const configResolved = plugin.configResolved as (config: unknown) => void;
      configResolved({ root: '/', build: { outDir } });
      (plugin.closeBundle as () => void)();
      expect(existsSync(join(outDir, 'favicon.png'))).toBe(false);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
