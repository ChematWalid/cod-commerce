import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SourceFile } from '../gates/branding';
import { findStockNavSections, STOCK_MERCHANT_SECTION_IDS } from '../gates/dashboard-nav-items';

const repoRoot = resolve(__dirname, '../../..');
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
  it.each(STOCK_MERCHANT_SECTION_IDS)("flags a nav item in the stock section '%s'", (sectionId) => {
    // Arrange
    const file = dashboardFile(`export const ITEM = { sectionId: '${sectionId}', id: 'x', title: 'X' };`);

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([
      `plugins/demo/dashboard/constants.ts puts a nav item in the stock merchant section '${sectionId}' (#122, D2111)`,
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
