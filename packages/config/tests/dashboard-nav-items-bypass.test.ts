import { describe, expect, it } from 'vitest';
import type { SourceFile } from '../gates/branding';
import { findStockNavSections } from '../gates/dashboard-nav-items';

/**
 * Forms that slipped past the regex version of the gate (review of P2.S1 task 5, round 2): the gate reads the
 * syntax tree now, and each form here is either resolved or reported, never skipped.
 */
const dashboardFile = (content: string, path: string): SourceFile => ({ path, content });

describe('findStockNavSections on forms it must not skip', () => {
  const INDEX = 'plugins/x/dashboard/index.ts';
  const violationsOf = (content: string): string[] => findStockNavSections([dashboardFile(content, INDEX)]);
  const unresolved = (text: string): string =>
    `${INDEX} names a nav section through '${text}', not a string literal or a const of this plugin's dashboard (#122, D2111)`;
  const stock = (section: string): string => `${INDEX} puts a nav item in the stock section '${section}' (#122, D2111)`;
  const stockApi = (name: string): string =>
    `${INDEX} uses '${name}', which edits the stock nav outside the merchant shell (ADR 0010) (#122, D2111)`;

  it.each([
    ['addNavMenuItem', "addNavMenuItem({ id: 'x', title: 'X', url: '/x' }, 'catalog');"],
    ['addNavMenuSection', "addNavMenuSection({ id: 'sales', title: 'Sales' });"],
    ['setNavMenuConfig', "setNavMenuConfig({ sections: [{ id: 'catalog', title: 'X' }] });"],
  ])('flags the imperative nav API %s outside the merchant shell', (name, content) => {
    // Arrange
    const source = `import { ${name} } from '@vendure/dashboard';\n${content}`;

    // Act
    const violations = violationsOf(source);

    // Assert
    expect(violations).toEqual([stockApi(name)]);
  });

  it('accepts the imperative nav API in the merchant shell', () => {
    // Arrange
    const shell = dashboardFile(
      "addNavMenuItem({ id: 'x', title: 'X', url: '/x' }, 'platform');",
      'plugins/merchant-shell/dashboard/index.tsx',
    );

    // Act
    const violations = findStockNavSections([shell]);

    // Assert
    expect(violations).toEqual([]);
  });

  it.each([
    ['a double-quoted key', `const ITEM = { "sectionId": 'catalog' };`],
    ['a single-quoted key', `const ITEM = { 'sectionId': 'catalog' };`],
    ['a computed string key', `const ITEM = { ['sectionId']: 'catalog' };`],
    ['a parenthesised value', `const ITEM = { sectionId: ('catalog') };`],
    ['a type assertion', `const ITEM = { sectionId: <string>'catalog' };`],
    ['an as-cast', `const ITEM = { sectionId: 'catalog' as const };`],
  ])('flags a stock section written with %s', (_form, content) => {
    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([stock('catalog')]);
  });

  it.each([
    ['a concatenation', `const ITEM = { sectionId: 'cat' + 'alog' };`, "'cat' + 'alog'"],
    ['an array index', `const ITEM = { sectionId: ['catalog'][0] };`, "['catalog'][0]"],
    ['a conditional', `const ITEM = { sectionId: a ? 'platform' : 'catalog' };`, "a ? 'platform' : 'catalog'"],
    ['a const built by concatenation', `const S = 'cat' + 'alog';\nconst ITEM = { sectionId: S };`, 'S'],
  ])('flags a section id written as %s, which it cannot resolve', (_form, content, text) => {
    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([unresolved(text)]);
  });

  it('flags a stock section behind a computed key it cannot resolve', () => {
    // Arrange
    const content = "const k = 'section' + 'Id';\nconst ITEM = { [k]: 'catalog' };";

    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([
      `${INDEX} puts the stock section 'catalog' behind the computed key '[k]' (#122, D2111)`,
    ]);
  });

  it('ignores sectionId in comments and strings', () => {
    // Arrange
    const content = "// sectionId: 'catalog'\nconst HELP = \"sectionId: 'catalog'\";";

    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([]);
  });
  it('flags a stock section passed as a sectionId JSX attribute', () => {
    // Arrange
    const file = dashboardFile(
      'export const Item = () => <NavItem sectionId="sales" />;',
      'plugins/x/dashboard/item.tsx',
    );

    // Act
    const violations = findStockNavSections([file]);

    // Assert
    expect(violations).toEqual([
      "plugins/x/dashboard/item.tsx puts a nav item in the stock section 'sales' (#122, D2111)",
    ]);
  });
});
