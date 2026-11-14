import { MAX_OPTION_GROUPS, MAX_OPTION_VALUES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  addGroup,
  addValue,
  isAddValueKey,
  moveGroup,
  moveValue,
  type OptionsDraft,
  removeGroup,
  removeValue,
  resetsVariants,
} from '../../dashboard/model/options-draft';

const colorAndSize: OptionsDraft = [
  { name: 'Color', values: ['Red', 'Blue'] },
  { name: 'Size', values: ['S', 'M', 'L'] },
];

describe('options draft', () => {
  it('adds a value on Enter and ignores an empty or duplicate one', () => {
    // Arrange
    const draft = colorAndSize;

    // Act
    const added = addValue(draft, 0, '  Green ');
    const empty = addValue(draft, 0, '   ');
    const duplicate = addValue(draft, 0, 'red');

    // Assert
    expect(isAddValueKey('Enter')).toBe(true);
    expect(isAddValueKey('a')).toBe(false);
    expect(added[0]?.values).toEqual(['Red', 'Blue', 'Green']);
    expect(empty).toBe(draft);
    expect(duplicate).toBe(draft);
    expect(draft[0]?.values).toEqual(['Red', 'Blue']);
  });

  it('ignores a value past the cap of values in one option', () => {
    // Arrange
    const full: OptionsDraft = [
      { name: 'Size', values: Array.from({ length: MAX_OPTION_VALUES }, (_, i) => `v${String(i)}`) },
    ];

    // Act
    const next = addValue(full, 0, 'one more');

    // Assert
    expect(next).toBe(full);
  });

  it('moves a value up and down', () => {
    // Act
    const down = moveValue(colorAndSize, 1, 0, 1);
    const up = moveValue(colorAndSize, 1, 2, -1);
    const outside = moveValue(colorAndSize, 1, 0, -1);

    // Assert
    expect(down[1]?.values).toEqual(['M', 'S', 'L']);
    expect(up[1]?.values).toEqual(['S', 'L', 'M']);
    expect(outside).toBe(colorAndSize);
  });

  it('moves an option and removes a value or an option', () => {
    // Act
    const moved = moveGroup(colorAndSize, 0, 1);
    const withoutM = removeValue(colorAndSize, 1, 1);
    const withoutColor = removeGroup(colorAndSize, 0);

    // Assert
    expect(moved.map((group) => group.name)).toEqual(['Size', 'Color']);
    expect(withoutM[1]?.values).toEqual(['S', 'L']);
    expect(withoutColor).toEqual([{ name: 'Size', values: ['S', 'M', 'L'] }]);
  });

  it('adds an option by name, never a blank, repeated or fourth one', () => {
    // Arrange
    const three: OptionsDraft = Array.from({ length: MAX_OPTION_GROUPS }, (_, i) => ({
      name: `o${String(i)}`,
      values: [],
    }));

    // Act
    const added = addGroup(colorAndSize, ' Material ');

    // Assert
    expect(added[2]).toEqual({ name: 'Material', values: [] });
    expect(addGroup(colorAndSize, '  ')).toBe(colorAndSize);
    expect(addGroup(colorAndSize, 'color')).toBe(colorAndSize);
    expect(addGroup(three, 'Material')).toBe(three);
  });

  it('flags a save that adds or removes an option group as resetting every variant', () => {
    // Arrange
    const withMaterial = addGroup(colorAndSize, 'Material');
    const withoutSize = removeGroup(colorAndSize, 1);
    const withGreen = addValue(colorAndSize, 0, 'Green');
    const reordered = moveGroup(colorAndSize, 0, 1);

    // Act and Assert
    expect(resetsVariants(colorAndSize, withMaterial)).toBe(true);
    expect(resetsVariants(colorAndSize, withoutSize)).toBe(true);
    expect(resetsVariants(colorAndSize, reordered)).toBe(true);
    expect(resetsVariants(colorAndSize, withGreen)).toBe(false);
    expect(resetsVariants([], [])).toBe(false);
  });
});
