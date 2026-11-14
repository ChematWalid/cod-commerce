import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SourceFile } from '../gates/branding';
import { findStockNavSections, STOCK_NAV_SECTION_IDS } from '../gates/dashboard-nav-items';

const repoRoot = resolve(__dirname, '../../..');
/** Vendure's own list, read from the dashboard package the merchant shell installs. */
const VENDURE_NAV_IDS = join(
  repoRoot,
  'plugins/merchant-shell/node_modules/@vendure/dashboard/src/lib/framework/nav-menu/nav-menu-ids.ts',
);
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage']);

const collect = (dir: string): SourceFile[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : collect(path);
    return [{ path: relative(repoRoot, path), content: readFileSync(path, 'utf8') }];
  });

const dashboardFile = (content: string, path = 'plugins/demo/dashboard/constants.ts'): SourceFile => ({
  path,
  content,
});

describe('findStockNavSections', () => {
  it("lists exactly the values of Vendure's BUILT_IN_NAV_SECTION_IDS", () => {
    // Arrange
    const source = readFileSync(VENDURE_NAV_IDS, 'utf8');
    const block = /BUILT_IN_NAV_SECTION_IDS = \{([^}]*)\}/.exec(source)?.[1] ?? '';

    // Act
    const vendureIds = [...block.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1]);

    // Assert
    expect([...STOCK_NAV_SECTION_IDS].sort()).toEqual(vendureIds.sort());
  });

  it.each(STOCK_NAV_SECTION_IDS)("flags a nav item in the stock section '%s'", (sectionId) => {
    // Arrange
    const file = dashboardFile(`export const ITEM = { sectionId: '${sectionId}', id: 'x', title: 'X' };`);

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([
      `plugins/demo/dashboard/constants.ts puts a nav item in the stock section '${sectionId}' (#122, D2111)`,
    ]);
  });

  it('flags a stock section named through a constant of another dashboard file', () => {
    // Arrange
    const constants = dashboardFile("export const SECTION: string = 'sales';");
    const route = dashboardFile('navMenuItem: { sectionId: SECTION, id: "x" }', 'plugins/demo/dashboard/routes/x.tsx');

    // Act
    const violations = findStockNavSections([constants, route]);

    // Assert
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('plugins/demo/dashboard/routes/x.tsx');
  });

  it('accepts the staff platform section, through a constant', () => {
    // Arrange
    const constants = dashboardFile("export const PLATFORM_SECTION_ID = 'platform';");
    const route = dashboardFile('navMenuItem: { sectionId: PLATFORM_SECTION_ID }', 'plugins/demo/dashboard/x.tsx');

    // Act
    const violations = findStockNavSections([constants, route]);

    // Assert
    expect(violations).toEqual([]);
  });

  it('resolves a constant in its own plugin when another plugin declares the same name', () => {
    // Arrange
    const stockConstant = dashboardFile("const SECTION = 'catalog';", 'plugins/x/dashboard/constants.ts');
    const stockRoute = dashboardFile('navMenuItem: { sectionId: SECTION }', 'plugins/x/dashboard/route.tsx');
    const staffConstant = dashboardFile("const SECTION = 'platform';", 'plugins/y/dashboard/constants.ts');
    const staffRoute = dashboardFile('navMenuItem: { sectionId: SECTION }', 'plugins/y/dashboard/route.tsx');

    // Act
    const violations = findStockNavSections([stockConstant, stockRoute, staffConstant, staffRoute]);

    // Assert
    expect(violations).toEqual([
      "plugins/x/dashboard/route.tsx puts a nav item in the stock section 'catalog' (#122, D2111)",
    ]);
  });

  it('flags the shorthand sectionId bound to a stock section', () => {
    // Arrange
    const file = dashboardFile("const sectionId = 'catalog';\nexport const ITEM = { sectionId, id: 'x' };");

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([
      "plugins/demo/dashboard/constants.ts puts a nav item in the stock section 'catalog' (#122, D2111)",
    ]);
  });

  it('flags BUILT_IN_NAV_SECTION_IDS, which it cannot resolve either', () => {
    // Arrange
    const file = dashboardFile(
      "import { BUILT_IN_NAV_SECTION_IDS } from '@vendure/dashboard';\nconst ITEM = { sectionId: BUILT_IN_NAV_SECTION_IDS.Catalog };",
      'plugins/x/dashboard/index.tsx',
    );

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([
      'plugins/x/dashboard/index.tsx refers to BUILT_IN_NAV_SECTION_IDS, the stock sections (#122, D2111)',
      "plugins/x/dashboard/index.tsx names a nav section through 'BUILT_IN_NAV_SECTION_IDS.Catalog', not a string literal or a const of this plugin's dashboard (#122, D2111)",
    ]);
  });

  it('flags a section id imported from outside the plugin dashboard', () => {
    // Arrange
    const file = dashboardFile(
      "import { SHARED_SECTION } from '@cod/shared';\nconst ITEM = { sectionId: SHARED_SECTION };",
      'plugins/x/dashboard/index.tsx',
    );

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([
      "plugins/x/dashboard/index.tsx names a nav section through 'SHARED_SECTION', not a string literal or a const of this plugin's dashboard (#122, D2111)",
    ]);
  });

  it('flags a navSections entry in a stock section', () => {
    // Arrange
    const file = dashboardFile(
      "defineDashboardExtension({ navSections: [{ id: 'catalog', title: 'X', items: [] }] });",
      'plugins/x/dashboard/index.js',
    );

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([
      "plugins/x/dashboard/index.js puts a nav item in the stock section 'catalog' (#122, D2111)",
    ]);
  });

  it('accepts a navSections entry for an own section named by a constant', () => {
    // Arrange
    const constants = dashboardFile(
      "export const PLATFORM_SECTION_ID = 'platform';",
      'plugins/x/dashboard/constants.ts',
    );
    const index = dashboardFile(
      'defineDashboardExtension({ navSections: [{ id: PLATFORM_SECTION_ID, order: 900 }] });',
      'plugins/x/dashboard/index.tsx',
    );

    // Act
    const violations = findStockNavSections([constants, index]);

    // Assert
    expect(violations).toEqual([]);
  });

  it('flags a navSections function outside the merchant shell, and accepts it in the shell', () => {
    // Arrange
    const content =
      "import { BUILT_IN_NAV_SECTION_IDS } from '@vendure/dashboard';\ndefineDashboardExtension({ navSections: (config) => config });";
    const plugin = dashboardFile(content, 'plugins/x/dashboard/index.tsx');
    const shell = dashboardFile(content, 'plugins/merchant-shell/dashboard/index.tsx');

    // Act
    const violations = findStockNavSections([plugin, shell]);

    // Assert
    expect(violations).toEqual([
      'plugins/x/dashboard/index.tsx refers to BUILT_IN_NAV_SECTION_IDS, the stock sections (#122, D2111)',
      'plugins/x/dashboard/index.tsx reshapes the nav with a non-array navSections (ADR 0010) (#122, D2111)',
    ]);
  });

  it('ignores a sectionId type annotation', () => {
    // Arrange
    const file = dashboardFile('interface Item { sectionId: string; other?: string }');

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([]);
  });

  it('ignores files outside a plugin dashboard', () => {
    // Arrange
    const server = { path: 'plugins/demo/api/x.ts', content: "const item = { sectionId: 'catalog' };" };

    // Act
    const violations = findStockNavSections([server]);

    // Assert
    expect(violations).toEqual([]);
  });

  it('no plugin dashboard registers a merchant (stock) nav section', () => {
    // Arrange
    const files = collect(join(repoRoot, 'plugins'));

    // Act
    const violations = findStockNavSections(files);

    // Assert
    expect(violations).toEqual([]);
  });
});
