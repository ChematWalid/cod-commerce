import { describe, expect, it } from 'vitest';
import { canSaveBusiness, canSaveStore, draftOfStore, storePatchOf } from '../dashboard/model/settings-form';

const SAVED = draftOfStore({ id: '1', name: 'Demo Store', description: 'Shoes', language: 'ar' });

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
});

describe('canSaveStore', () => {
  it('is off until something changed', () => {
    expect(canSaveStore(SAVED, SAVED)).toBe(false);
    expect(canSaveStore({ ...SAVED, language: 'en' }, SAVED)).toBe(true);
  });

  it('is off for a blank name', () => {
    expect(canSaveStore({ ...SAVED, name: '   ' }, SAVED)).toBe(false);
  });
});

describe('canSaveBusiness', () => {
  it('needs a changed, non-blank name', () => {
    const saved = { name: 'Demo' };
    expect(canSaveBusiness({ name: 'Demo' }, saved)).toBe(false);
    expect(canSaveBusiness({ name: ' Demo ' }, saved)).toBe(false);
    expect(canSaveBusiness({ name: '  ' }, saved)).toBe(false);
    expect(canSaveBusiness({ name: 'Demo 2' }, saved)).toBe(true);
  });
});
