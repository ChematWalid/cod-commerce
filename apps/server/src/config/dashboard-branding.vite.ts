import { readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PRODUCT_NAME } from '@cod/shared';
import type { Plugin } from 'vite';

/** The file the icon is emitted as, at the root of the dashboard build. */
export const ICON_FILE_NAME = 'brand-icon.svg';

/** The framework's icon, which the package's public folder copies into the build. */
const STOCK_ICON_FILE_NAME = 'favicon.png';

/** Our own artwork: a neutral glyph that names no product. */
const ICON_SOURCE_PATH = join(__dirname, '../assets/brand-icon.svg');

/** What follows the product name in the description meta tag. */
export const DESCRIPTION_SUFFIX = ' merchant dashboard';

/** The icon link of the package's `index.html`, which names a PNG of the framework. */
const ICON_LINK = /<link\s+rel="icon"[^>]*>/;
/** The two meta tags of the package's `index.html` that name the framework. */
const DESCRIPTION_META = /<meta\s+name="description"[^>]*>/;
const AUTHOR_META = /<meta\s+name="author"[^>]*>/;

/** Raised when the package's `index.html` no longer has a tag this module rewrites: an upgrade must not undo the branding silently. */
export class DashboardBrandingError extends Error {
  constructor(tag: string) {
    super(
      `dashboard branding: the ${tag} tag is missing from @vendure/dashboard's index.html; update dashboard-branding.vite.ts`,
    );
    this.name = 'DashboardBrandingError';
  }
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function replaceTag(html: string, pattern: RegExp, tag: string, replacement: string): string {
  if (!pattern.test(html)) throw new DashboardBrandingError(tag);
  // A function replacer, so that `$` in the product name is not read as a replacement pattern.
  return html.replace(pattern, () => replacement);
}

/**
 * Rewrites the favicon link, the description and the author of the dashboard's `index.html` so that none names the
 * framework. `iconHref` is what the icon link points at; the plugin gives it the base path (see
 * {@link dashboardBrandingPlugin}).
 */
export function brandDashboardHtml(html: string, productName: string, iconHref: string = ICON_FILE_NAME): string {
  const name = escapeAttribute(productName);
  const withIcon = replaceTag(
    html,
    ICON_LINK,
    'icon link',
    `<link rel="icon" type="image/svg+xml" href="${escapeAttribute(iconHref)}" />`,
  );
  const withDescription = replaceTag(
    withIcon,
    DESCRIPTION_META,
    'description meta',
    `<meta name="description" content="${name}${escapeAttribute(DESCRIPTION_SUFFIX)}" />`,
  );
  return replaceTag(withDescription, AUTHOR_META, 'author meta', `<meta name="author" content="${name}" />`);
}

/** The plugin with its HTML hook typed as the object form, so a test can call the handler. */
export type DashboardBrandingPlugin = Plugin & {
  readonly transformIndexHtml: { readonly order: 'pre'; readonly handler: (html: string) => string };
};

/**
 * Brands the dashboard's HTML and emits the icon (D91). Its `transformIndexHtml` runs `pre`, explicitly: the
 * stock plugin's rewrite (`vite:vite-config-transform-index-html`) then strips the base path from every
 * `href` and `src` and adds a `<base>` tag, so the icon href, written with the base path here, ends up relative
 * to `<base>` like the stock assets.
 */
export function dashboardBrandingPlugin(basePath: string): DashboardBrandingPlugin {
  const iconHref = `${basePath.replace(/\/$/, '')}/${ICON_FILE_NAME}`;
  let outDir = '';
  let isBuild = false;
  return {
    name: 'cod:dashboard-branding',
    transformIndexHtml: {
      order: 'pre',
      handler: (html: string) => brandDashboardHtml(html, PRODUCT_NAME, iconHref),
    },
    configureServer(server) {
      // `vite dev` has no bundle to emit into, so it serves the icon itself.
      server.middlewares.use(iconHref, (_request, response) => {
        response.setHeader('Content-Type', 'image/svg+xml');
        response.end(readFileSync(ICON_SOURCE_PATH));
      });
    },
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: ICON_FILE_NAME, source: readFileSync(ICON_SOURCE_PATH) });
    },
    closeBundle() {
      // Only a build writes the output folder; `vite dev` must not touch an earlier build's files.
      if (!isBuild) return;
      // The package's public folder copies its own PNG into every build, after the bundle is generated; nothing
      // refers to it any more.
      rmSync(join(outDir, STOCK_ICON_FILE_NAME), { force: true });
    },
  };
}
