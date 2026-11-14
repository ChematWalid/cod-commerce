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

  it('is idempotent', () => {
    for (const text of ['حِذاءٌ رياضي', 'حـــذاء', 'أإآى ة', 'CAFÉ  Noir', 'İstanbul', 'Straße', '  x  ']) {
      const once = normalForMatch(text);

      expect(normalForMatch(once)).toBe(once);
      expect(normalForMatch(text.normalize('NFD'))).toBe(once);
    }
  });
});
