import { RBAC_ERROR_CODES, ROLE_NAME_MAX_LENGTH, UnknownPermissionError } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { translationKeyOf } from '../../api/error-mapping';
import ar from '../../api/i18n/ar.json';
import en from '../../api/i18n/en.json';
import { RoleDescriptionTooLongError } from '../../domain/errors';
import { permissionsDiff } from '../../domain/role-diff';
import { parseDescription, resolvePermissions } from '../../domain/role-input';
import { copyLocaleOf, copyNameOf } from '../../domain/role-name';
import { reachOf } from '../../domain/store-access';
import { toStoreId } from '@cod/shared';

const NONE = { areaLevels: [], grants: [], revokes: [] };

describe('copyNameOf', () => {
  const free = (): boolean => false;

  it('adds the copy word in the language asked for', () => {
    expect(copyNameOf('Sales', 'en', free).name).toBe('Sales (copy)');
    expect(copyNameOf('مبيعات', 'ar', free).name).toBe('مبيعات (نسخة)');
  });

  it('numbers past every taken key', () => {
    const taken = new Set(['sales (copy)', 'sales (copy 2)']);

    expect(copyNameOf('Sales', 'en', (key) => taken.has(key)).name).toBe('Sales (copy 3)');
  });

  it('cuts the source to stay within the limit, without a space before the suffix', () => {
    const source = `${'a'.repeat(ROLE_NAME_MAX_LENGTH - 8)} bbbbbbb`;

    const { name } = copyNameOf(source, 'en', free);

    expect(Array.from(name).length).toBeLessThanOrEqual(ROLE_NAME_MAX_LENGTH);
    expect(name).toBe(`${'a'.repeat(ROLE_NAME_MAX_LENGTH - 8)} (copy)`.slice(0, ROLE_NAME_MAX_LENGTH));
    expect(name).not.toContain('  ');
  });

  it('defaults an unknown locale to English', () => {
    expect(copyLocaleOf('fr')).toBe('en');
    expect(copyLocaleOf(undefined)).toBe('en');
    expect(copyLocaleOf('ar')).toBe('ar');
  });
});

describe('role inputs', () => {
  it('refuses an unknown area, level or key', () => {
    expect(() => resolvePermissions([], { ...NONE, areaLevels: [{ area: 'x', level: 'full' }] })).toThrow(
      UnknownPermissionError,
    );
    expect(() => resolvePermissions([], { ...NONE, areaLevels: [{ area: 'orders', level: 'x' }] })).toThrow();
    expect(() => resolvePermissions([], { ...NONE, grants: ['UpdateAdministrator'] })).toThrow(UnknownPermissionError);
  });

  it('applies grants after levels and revokes last', () => {
    const result = resolvePermissions(['orders.cancel'], {
      areaLevels: [{ area: 'orders', level: 'none' }],
      grants: ['orders.view'],
      revokes: ['orders.view'],
    });

    expect(result).toEqual([]);
  });

  it('keeps a blank description as none, and refuses one over the limit', () => {
    expect(parseDescription('   ')).toBeNull();
    expect(parseDescription(' Packs orders ')).toBe('Packs orders');
    expect(() => parseDescription('x'.repeat(256))).toThrow(RoleDescriptionTooLongError);
  });
});

describe('permissionsDiff', () => {
  it('names what was added and removed', () => {
    expect(permissionsDiff(['orders.view', 'orders.cancel'], ['orders.view', 'orders.delete'])).toEqual({
      added: ['orders.delete'],
      removed: ['orders.cancel'],
    });
  });
});

describe('reachOf', () => {
  const [one, two] = [toStoreId('1'), toStoreId('2')];

  it('makes an all binding reach every active store', () => {
    expect(reachOf(['all'], [one, two])).toEqual([one, two]);
  });

  it('ignores a binding on a store that is not active', () => {
    expect(reachOf(['3', one], [one, two])).toEqual([one]);
  });
});

describe('error messages', () => {
  it.each(Object.values(RBAC_ERROR_CODES))('translates %s in English and Arabic', (code) => {
    const key = translationKeyOf(code);

    expect((en.error as Record<string, string>)[key]).toBeDefined();
    expect((ar.error as Record<string, string>)[key]).toBeDefined();
  });
});
