import { describe, expect, it } from 'vitest';
import { normalForMatch } from '../../src/index';

/** True when `title` contains `value` once both are in their normal form for matching. */
const containsForMatch = (title: string, value: string): boolean =>
  normalForMatch(title).includes(normalForMatch(value));

describe('normalForMatch', () => {
  it('matches Arabic titles whatever their harakat, tatweel, letter variant or normal form', () => {
    // Arrange
    const value = 'حذاء';

    // Act + Assert
    expect(containsForMatch('حِذاءٌ رياضي', value)).toBe(true);
    expect(containsForMatch('حـــذاء رياضي', value)).toBe(true);
    expect(containsForMatch('حِذاءٌ أنيق'.normalize('NFD'), 'انيق')).toBe(true);
    expect(containsForMatch('حذاء أنيق', 'إنيق')).toBe(true);
    expect(containsForMatch('مكتبة الفتى', 'مكتبه الفتي')).toBe(true);
    expect(containsForMatch('Running shoe', 'SHOE')).toBe(true);
    expect(containsForMatch('Running shoe', 'boot')).toBe(false);
  });

  it('folds alef, alef maqsura and ta marbuta variants', () => {
    expect(normalForMatch('أإآا')).toBe('اااا');
    expect(normalForMatch('فتى')).toBe(normalForMatch('فتي'));
    expect(normalForMatch('مدرسة')).toBe(normalForMatch('مدرسه'));
    expect(normalForMatch('آية'.normalize('NFD'))).toBe(normalForMatch('اية'));
  });

  it('removes harakat and tatweel', () => {
    expect(normalForMatch('حِذَاءٌ')).toBe('حذاء');
    expect(normalForMatch('كـــتاب')).toBe('كتاب');
  });

  it('folds case and Unicode form of Latin text', () => {
    expect(normalForMatch('CAFÉ')).toBe(normalForMatch('café'));
    expect(normalForMatch('Running SHOE')).toBe('running shoe');
  });

  it('collapses and trims whitespace', () => {
    expect(normalForMatch('  red \t\n  shoe  ')).toBe('red shoe');
  });

  it('turns text made only of marks, tatweel or spaces into the empty string', () => {
    expect(normalForMatch('َِ ـ ')).toBe('');
  });

  it('ignores zero-width joiners, non-joiners and other invisible format characters', () => {
    expect(containsForMatch('حذ\u200Dاء رياضي', 'حذاء')).toBe(true);
    expect(containsForMatch('a\u200Cb\u200Bc\u2060d\uFEFFe\u00ADf', 'abcdef')).toBe(true);
    expect(normalForMatch('\u200C')).toBe('');
  });

  it('reads Arabic presentation forms and alef wasla as plain letters', () => {
    expect(normalForMatch('\uFEA3\uFEAC\uFE8D\uFE80')).toBe(normalForMatch('حذاء'));
    expect(normalForMatch('\uFEFB')).toBe('لا');
    expect(normalForMatch('ٱلكتاب')).toBe(normalForMatch('الكتاب'));
  });

  it('folds the Turkish dotted I and the German sharp s', () => {
    expect(normalForMatch('İstanbul')).toBe('istanbul');
    expect(normalForMatch('STRASSE')).toBe(normalForMatch('straße'));
  });

  it('is idempotent', () => {
    const samples = [
      'حِذاءٌ رياضي',
      'حـــذاء',
      'أإآى ة',
      'CAFÉ  Noir',
      'İstanbul',
      'Straße',
      '  x  ',
      'ﻻ ٱ',
      'a\u200Db',
    ];
    for (const text of samples) {
      const once = normalForMatch(text);

      expect(normalForMatch(once)).toBe(once);
      expect(normalForMatch(text.normalize('NFD'))).toBe(once);
    }
  });
});
