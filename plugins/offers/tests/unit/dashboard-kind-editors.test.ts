import { MAX_ADDON_PRODUCTS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { OFFER_APP_TYPES } from '../../domain/app-types';
import { defaultConfigOf } from '../../dashboard/model/default-configs';
import type { TargetDraft } from '../../dashboard/model/editor-form';
import { addTargetOfRole, KIND_EDITOR_IDS, readConfig, wholeNumberOf } from '../../dashboard/model/kind-editors';

describe('per-kind editors', () => {
  it('has an editor for every app type id', () => {
    // Arrange
    const appTypeIds = OFFER_APP_TYPES.map((type) => type.id);

    // Assert
    expect([...KIND_EDITOR_IDS].sort()).toEqual([...appTypeIds].sort());
    expect(appTypeIds.filter((id) => defaultConfigOf(id) === undefined)).toEqual([]);
  });

  it('limits add-on targets to five', () => {
    // Arrange
    const buy: TargetDraft = { role: 'buy', refType: 'product', refId: '1' };
    let targets: readonly TargetDraft[] = [buy];

    // Act
    for (let id = 10; id < 17; id += 1) {
      targets = addTargetOfRole(targets, { role: 'addon', refType: 'product', refId: String(id) });
    }

    // Assert
    expect(targets.filter((target) => target.role === 'addon')).toHaveLength(MAX_ADDON_PRODUCTS);
    expect(targets[0]).toBe(buy);
  });

  it('reads a configuration over its defaults and typed whole numbers', () => {
    // Act
    const config = readConfig({ value: 25, stray: true }, { valueType: 'percent', value: 10, cap: null });
    const broken = readConfig('not an object', { valueType: 'percent', value: 10, cap: null });

    // Assert
    expect(config).toEqual({ valueType: 'percent', value: 25, cap: null, stray: true });
    expect(broken).toEqual({ valueType: 'percent', value: 10, cap: null });
    expect([wholeNumberOf(' 12 '), wholeNumberOf(''), wholeNumberOf('1.5'), wholeNumberOf('-3')]).toEqual([
      12,
      null,
      undefined,
      undefined,
    ]);
  });
});
