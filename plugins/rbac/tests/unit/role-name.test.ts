import { describe, expect, it } from 'vitest';
import { RoleNameInvalidError } from '../../domain/errors';
import { parseRoleName } from '../../domain/role-name';

describe('parseRoleName', () => {
  it('trims and collapses spaces in the name it keeps', () => {
    expect(parseRoleName('  Sales \t  team ').name).toBe('Sales team');
  });

  it('gives names that differ only by case the same key', () => {
    expect(parseRoleName('SALES').nameKey).toBe(parseRoleName('sales').nameKey);
  });

  it('gives a sharp s and its capital spelling the same key', () => {
    expect(parseRoleName('Straße').nameKey).toBe(parseRoleName('STRASSE').nameKey);
  });

  it('gives an Arabic presentation form and its plain letters the same key', () => {
    expect(parseRoleName('ﻡﺪﻴﺮ').nameKey).toBe(parseRoleName('مدير').nameKey);
  });

  it.each(['', '   ', 'x'.repeat(61)])('refuses %j', (name) => {
    expect(() => parseRoleName(name)).toThrow(RoleNameInvalidError);
  });

  it('counts characters, not UTF-16 units, against the limit', () => {
    expect(parseRoleName('😀'.repeat(60)).name).toHaveLength(120);
  });
});
