import { describe, expect, it } from 'vitest';
import {
  businessPatchOf,
  canSaveBusiness,
  canSaveStore,
  draftOfBusiness,
  draftOfStore,
  storePatchOf,
} from '../dashboard/model/settings-form';

const SAVED = draftOfStore({
  id: '1',
  name: 'Demo Store',
  description: 'Shoes',
  language: 'ar',
  logoAssetId: null,
  logoUrl: null,
  showAddressField: true,
  soldOutBehavior: 'keep',
});

const SAVED_BUSINESS = draftOfBusiness({ id: '9', name: 'Demo', logoAssetId: '7', logoUrl: 'https://x.test/l.png' });

describe('storePatchOf', () => {
  it('sends only the fields that changed', () => {
    // Arrange
    const draft = { ...SAVED, description: 'Shoes and bags' };

    // Act
    const patch = storePatchOf(draft, SAVED);

    // Assert
    expect(patch).toEqual({ description: 'Shoes and bags' });
  });

  it('trims the name it sends', () => {
    expect(storePatchOf({ ...SAVED, name: '  Renamed  ' }, SAVED)).toEqual({ name: 'Renamed' });
  });

  it('is empty when nothing changed, even if the name only differs by spaces', () => {
    expect(storePatchOf({ ...SAVED, name: 'Demo Store ' }, SAVED)).toEqual({});
  });

  it('can clear the description', () => {
    expect(storePatchOf({ ...SAVED, description: '' }, SAVED)).toEqual({ description: '' });
  });

  it('includes soldOutBehavior and showAddressField only when changed', () => {
    // Arrange
    const unchanged = { ...SAVED, soldOutBehavior: 'keep', showAddressField: true } as const;
    const changed = { ...SAVED, soldOutBehavior: 'hide', showAddressField: false } as const;

    // Act
    const none = storePatchOf(unchanged, SAVED);
    const both = storePatchOf(changed, SAVED);

    // Assert
    expect(none).toEqual({});
    expect(both).toEqual({ soldOutBehavior: 'hide', showAddressField: false });
  });

  it('includes logoAssetId when the logo is replaced', () => {
    // Arrange
    const draft = { ...SAVED, logoAssetId: '42' };

    // Act
    const patch = storePatchOf(draft, SAVED);

    // Assert
    expect(patch).toEqual({ logoAssetId: '42' });
  });
});

describe('businessPatchOf', () => {
  it('includes logoAssetId when the logo is replaced, and the trimmed name when renamed', () => {
    // Arrange
    const replaced = { ...SAVED_BUSINESS, logoAssetId: '8' };
    const renamed = { ...SAVED_BUSINESS, name: ' Demo 2 ' };

    // Act
    const logoPatch = businessPatchOf(replaced, SAVED_BUSINESS);
    const namePatch = businessPatchOf(renamed, SAVED_BUSINESS);

    // Assert
    expect(logoPatch).toEqual({ logoAssetId: '8' });
    expect(namePatch).toEqual({ name: 'Demo 2' });
  });
});

describe('canSaveStore', () => {
  it('is off until something changed', () => {
    expect(canSaveStore(SAVED, SAVED)).toBe(false);
    expect(canSaveStore({ ...SAVED, language: 'en' }, SAVED)).toBe(true);
    expect(canSaveStore({ ...SAVED, soldOutBehavior: 'hide' }, SAVED)).toBe(true);
  });

  it('is off for a blank name', () => {
    expect(canSaveStore({ ...SAVED, name: '   ' }, SAVED)).toBe(false);
  });
});

describe('canSaveBusiness', () => {
  it('needs a changed, non-blank name', () => {
    const saved = { name: 'Demo', logoAssetId: null };
    expect(canSaveBusiness({ name: 'Demo', logoAssetId: null }, saved)).toBe(false);
    expect(canSaveBusiness({ name: ' Demo ', logoAssetId: null }, saved)).toBe(false);
    expect(canSaveBusiness({ name: '  ', logoAssetId: null }, saved)).toBe(false);
    expect(canSaveBusiness({ name: 'Demo 2', logoAssetId: null }, saved)).toBe(true);
  });

  it('is on when only the logo was replaced', () => {
    expect(canSaveBusiness({ ...SAVED_BUSINESS, logoAssetId: '8' }, SAVED_BUSINESS)).toBe(true);
  });
});
