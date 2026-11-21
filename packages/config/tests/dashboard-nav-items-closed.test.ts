import { describe, expect, it } from 'vitest';
import { findStockNavSections } from '../gates/dashboard-nav-items';

/**
 * Forms found in review round 4 of P2.S1 task 5: the gate fails closed. A name resolves to a plugin `const` only
 * when nothing else in the plugin's dashboard binds it, and `sectionId` given as data is reported, not skipped.
 */
const INDEX = 'plugins/x/dashboard/index.tsx';
const violationsOf = (content: string): string[] => findStockNavSections([{ path: INDEX, content }]);
const unresolved = (text: string): string =>
  `${INDEX} names a nav section through '${text}', not a string literal or a const of this plugin's dashboard (#122, D2111)`;
const keyAsData = (text: string): string =>
  `${INDEX} passes the key 'sectionId' as data in '${text}', a nav item it cannot read (#122, D2111)`;

describe('findStockNavSections with names that shadow a const', () => {
  it.each([
    ['a parameter', "const S = 'platform';\nfunction item(S: string) { return { sectionId: S }; }"],
    ['an arrow parameter', "const S = 'platform';\nconst item = (S: string) => ({ sectionId: S });"],
    ['a destructured binding', "const S = 'platform';\nfunction item({ S }: Args) { return { sectionId: S }; }"],
    ['a let', "const S = 'platform';\nfunction item() { let S = pick(); return { sectionId: S }; }"],
    ['a const it cannot read', "const S = 'platform';\nfunction item() { const S = pick(); return { sectionId: S }; }"],
  ])('flags a section id whose const name is rebound by %s', (_form, content) => {
    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([unresolved('S')]);
  });

  it('flags a navMenuItem whose const object name is rebound by a parameter', () => {
    // Arrange
    const content =
      "const ITEM = { id: 'x', sectionId: 'platform' };\nexport const route = (ITEM: object) => ({ navMenuItem: ITEM });";

    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([`${INDEX} has a navMenuItem 'ITEM' it cannot read (#122, D2111)`]);
  });

  it('accepts the staff platform section through PLATFORM_SECTION_ID when nothing rebinds it', () => {
    // Arrange
    const content =
      "const PLATFORM_SECTION_ID = 'platform';\nfunction item(id: string) { return { id, sectionId: PLATFORM_SECTION_ID }; }";

    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([]);
  });
});

describe('findStockNavSections with a section id written as data', () => {
  it('flags a stock section const behind a computed key it cannot resolve', () => {
    // Arrange
    const content = "const SECTION = 'catalog';\nconst ITEM = { [keyOf()]: SECTION };";

    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([
      `${INDEX} puts the stock section 'catalog' behind the computed key '[keyOf()]' (#122, D2111)`,
    ]);
  });

  it.each([
    ['Object.defineProperty', "Object.defineProperty(item, 'sectionId', { value: 'catalog' });", "'sectionId'"],
    ['Reflect.set', "Reflect.set(item, 'sectionId', 'catalog');", "'sectionId'"],
    ['Object.fromEntries', "const ITEM = Object.fromEntries([['sectionId', 'catalog']]);", "'sectionId'"],
    ['a const key passed to a call', "const K = 'sectionId';\nReflect.set(item, K, 'catalog');", 'K'],
  ])('flags the sectionId key passed as data to %s', (_form, content, text) => {
    // Act
    const violations = violationsOf(content);

    // Assert
    expect(violations).toEqual([keyAsData(text)]);
  });

  it('still ignores sectionId inside a longer string', () => {
    // Act
    const violations = violationsOf("const HELP = 'set sectionId to platform';");

    // Assert
    expect(violations).toEqual([]);
  });
});
