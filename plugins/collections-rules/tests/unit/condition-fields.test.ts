import { describe, expect, it } from 'vitest';
import type { StoreCollectionRuleOptionsDto } from '../../dashboard/dto';
import {
  conditionFieldsOf,
  fieldChoiceOf,
  isPickedValue,
  RULE_LABEL_IDS,
  unknownValuesOf,
  valueChoicesOf,
  valueInputOf,
  withToggledValue,
} from '../../dashboard/model/condition-fields';
import { conditionFor } from '../../dashboard/model/rule-draft';

const OPTIONS: StoreCollectionRuleOptionsDto = {
  brands: [{ id: '7301234567890123401', name: 'Atlas' }],
  tags: [{ id: '7301234567890123402', name: 'promo' }],
  options: [
    { name: 'Color', values: ['Red', 'Blue'] },
    { name: 'المقاس', values: ['M', 'L'] },
  ],
};

describe('condition fields', () => {
  it('offers one option field per store option name', () => {
    // Act
    const fields = conditionFieldsOf(OPTIONS);

    // Assert
    expect(fields.map(({ key }) => key)).toEqual([
      'tag',
      'brand',
      'price',
      'on_sale',
      'title',
      'option:Color',
      'option:المقاس',
    ]);
    expect(fields.filter(({ field }) => field === 'option').map(({ option }) => option)).toEqual(['Color', 'المقاس']);
  });

  it('offers the values of the condition field: tags, brands or the option values', () => {
    // Arrange
    const [color] = conditionFieldsOf(OPTIONS).filter(({ field }) => field === 'option');
    if (color === undefined) throw new Error('the store has a Color option');

    // Act
    const tags = valueChoicesOf(conditionFor({ key: 'tag', field: 'tag', option: null }), OPTIONS);
    const colors = valueChoicesOf({ ...conditionFor(color), option: 'color' }, OPTIONS);
    const title = valueChoicesOf(conditionFor({ key: 'title', field: 'title', option: null }), OPTIONS);

    // Assert
    expect(tags).toEqual([{ id: '7301234567890123402', name: 'promo' }]);
    expect(colors).toEqual([
      { id: 'Red', name: 'Red' },
      { id: 'Blue', name: 'Blue' },
    ]);
    expect(title).toBeNull();
  });

  it('keeps a stored option name the store no longer has as its own field', () => {
    // Arrange
    const stored = { ...conditionFor({ key: 'option:Fabric', field: 'option', option: 'Fabric' }) };

    // Act
    const choice = fieldChoiceOf(stored);

    // Assert
    expect(choice).toEqual({ key: 'option:Fabric', field: 'option', option: 'Fabric' });
  });

  it('names the stored ids the store no longer offers', () => {
    // Arrange
    const choices = [{ id: 'a', name: 'A' }];

    // Act
    const unknown = unknownValuesOf(['a', 'gone'], choices, 'tag');

    // Assert
    expect(unknown).toEqual(['gone']);
  });

  it("a title row offers the word input while the store's options load", () => {
    // Arrange
    const title = conditionFor({ key: 'title', field: 'title', option: null });

    // Act
    const input = valueInputOf(title, undefined);

    // Assert
    expect(input).toEqual({ kind: 'words' });
  });

  it("a tag, brand or option row waits for the store's options instead of calling its values unknown", () => {
    // Arrange
    const tag = { ...conditionFor({ key: 'tag', field: 'tag', option: null }), values: ['7301234567890123402'] };
    const color = conditionFor({ key: 'option:Color', field: 'option', option: 'Color' });

    // Act
    const inputs = [valueInputOf(tag, undefined), valueInputOf(color, undefined)];
    const loaded = valueInputOf(tag, OPTIONS);

    // Assert
    expect(inputs).toEqual([{ kind: 'unavailable' }, { kind: 'unavailable' }]);
    expect(loaded).toEqual({ kind: 'choices', choices: OPTIONS.tags });
  });

  it('a price or on-sale row has its own input whatever the options', () => {
    // Act
    const price = valueInputOf(conditionFor({ key: 'price', field: 'price', option: null }), undefined);
    const onSale = valueInputOf(conditionFor({ key: 'on_sale', field: 'on_sale', option: null }), OPTIONS);

    // Assert
    expect(price).toEqual({ kind: 'range' });
    expect(onSale).toEqual({ kind: 'yes-no' });
  });

  it('an option value the store lists in another case is not unknown', () => {
    // Arrange
    const choices = [{ id: 'red', name: 'red' }];

    // Act
    const optionUnknown = unknownValuesOf(['Red', 'Gone'], choices, 'option');
    const tagUnknown = unknownValuesOf(['Red'], choices, 'tag');

    // Assert
    expect(optionUnknown).toEqual(['Gone']);
    expect(tagUnknown).toEqual(['Red']);
  });

  it('an option value stored in another case shows as picked and is removed by its choice', () => {
    // Arrange
    const stored = ['Red'];

    // Act
    const picked = isPickedValue(stored, 'red', 'option');
    const toggled = withToggledValue(stored, 'red', 'option');

    // Assert
    expect(picked).toBe(true);
    expect(toggled).toEqual([]);
  });

  it('labels every field and operator of the shared registry', () => {
    // Act
    const ids = new Set(RULE_LABEL_IDS);

    // Assert
    expect(ids.size).toBe(12);
    expect(ids.has('collections.field-on_sale')).toBe(true);
    expect(ids.has('collections.operator-not_contains')).toBe(true);
  });
});
