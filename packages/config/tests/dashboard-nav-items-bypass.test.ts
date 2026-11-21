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

/** Forms found in review round 3 of P2.S1 task 5: assignments, bracket access and the nav carriers. */
describe('findStockNavSections on assignments, bracket access and nav carriers', () => {
  const INDEX = 'plugins/x/dashboard/index.tsx';
  const violationsOf = (content: string): string[] => findStockNavSections([dashboardFile(content, INDEX)]);
  const stock = (section: string): string => `${INDEX} puts a nav item in the stock section '${section}' (#122, D2111)`;
  const unreadableItem = (text: string): string => `${INDEX} has a navMenuItem '${text}' it cannot read (#122, D2111)`;
  const unreadableEntry = (text: string): string =>
    `${INDEX} has a navSections entry '${text}' it cannot read (#122, D2111)`;

  it.each([
    ['a property assignment', "const item: Record<string, string> = {};\nitem.sectionId = 'catalog';", 'catalog'],
    ['an element assignment', "const item: Record<string, string> = {};\nitem['sectionId'] = 'sales';", 'sales'],
    ['an element assignment through a const key', "const k = 'sectionId';\nitem[k] = 'sales';", 'sales'],
    [
      'a computed key and value behind consts',
      "const S = 'catalog';\nconst k = 'sectionId';\nconst I = { [k]: S };",
      'catalog',
    ],
    [
      'a shorthand navSections id',
      "const id = 'catalog';\ndefineDashboardExtension({ navSections: [{ id, title: 'X' }] });",
      'catalog',
    ],
  ])('flags a stock section set through %s', (_form, content, section) => {
    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([stock(section)]);
  });

  it('flags an element assignment through a key it cannot resolve', () => {
    // Act
    const violations = violationsOf("item[keyOf()] = 'catalog';");

    // Assert
    expect(violations).toEqual([`${INDEX} sets a property through 'keyOf()', a key it cannot resolve (#122, D2111)`]);
  });

  it('flags the imperative nav API reached by bracket access on the namespace', () => {
    // Arrange
    const content = "import * as d from '@vendure/dashboard';\nd['addNavMenuItem']({ id: 'x' }, 'catalog');";

    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([
      `${INDEX} uses 'addNavMenuItem', which edits the stock nav outside the merchant shell (ADR 0010) (#122, D2111)`,
    ]);
  });

  it('flags a dashboard namespace member it cannot resolve', () => {
    // Arrange
    const content = "import * as vd from '@vendure/dashboard';\nvd['addNavMenu' + 'Item']({ id: 'x' }, 'catalog');";

    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([
      `${INDEX} reaches @vendure/dashboard through 'vd['addNavMenu' + 'Item']', a member it cannot resolve (ADR 0010) (#122, D2111)`,
    ]);
  });

  it.each([
    [
      'an import from outside the dashboard',
      "import { ITEM } from '@cod/shared';\nconst R = { navMenuItem: ITEM };",
      'ITEM',
    ],
    ['a helper call', "const R = { navMenuItem: navItem('catalog') };", "navItem('catalog')"],
    ['a spread', "const R = { navMenuItem: { ...BASE, id: 'x' } };", "{ ...BASE, id: 'x' }"],
    ['no sectionId', "const R = { navMenuItem: { id: 'x' } };", "{ id: 'x' }"],
    [
      'a const with a computed key it cannot resolve',
      "const ITEM = { ['section' + 'Id']: 'cat' + 'alog' };\nconst R = { navMenuItem: ITEM };",
      'ITEM',
    ],
  ])('flags a navMenuItem given as %s', (_form, content, text) => {
    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([unreadableItem(text)]);
  });

  it('accepts a navMenuItem const of the same plugin in an own section', () => {
    // Arrange
    const item = dashboardFile(
      "export const ITEM = { sectionId: 'platform', id: 'x' };",
      'plugins/x/dashboard/item.ts',
    );
    const route = dashboardFile('export const R = { navMenuItem: ITEM };', 'plugins/x/dashboard/route.tsx');

    // Act
    const violations = findStockNavSections([item, route]);

    // Assert
    expect(violations).toEqual([]);
  });

  it.each([
    ['a spread', "[{ ...{ id: 'catalog' }, title: 'X' }]", "{ ...{ id: 'catalog' }, title: 'X' }"],
    ['no id', "[{ title: 'X' }]", "{ title: 'X' }"],
  ])('flags a navSections entry with %s', (_form, sections, text) => {
    // Act
    const violations = violationsOf(`defineDashboardExtension({ navSections: ${sections} });`);

    // Assert
    expect(violations).toEqual([unreadableEntry(text)]);
  });
});
