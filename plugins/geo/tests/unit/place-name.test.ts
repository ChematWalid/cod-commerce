import { WILAYA_COUNT, WILAYAS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { filterByName, fold, matchesPlaceName, type NamedPlace } from '../../domain/place-name';

const alger: NamedPlace = { name: 'Alger', arabicName: 'الجزائر', names: ['الجزائر', 'Algiers'] };
const chlef: NamedPlace = { name: 'Chlef', arabicName: 'الشلف', names: ['الشلف', 'Ech Cheliff'] };
const tizi: NamedPlace = { name: 'Tizi Ouzou', arabicName: 'تيزي وزو', names: ['Tizi-Ouzou'] };
const msila: NamedPlace = { name: "M'Sila", arabicName: 'المسيلة', names: [] };
const temouchent: NamedPlace = { name: 'Aïn Témouchent', arabicName: 'عين تموشنت', names: [] };
const adrar: NamedPlace = { name: 'Adrar', arabicName: 'أدرار', names: [] };

describe('fold', () => {
  it('ignores case and Latin accents', () => {
    // Act
    const folded = fold('AÏN Témouchent');

    // Assert
    expect(folded).toBe(fold('ain temouchent'));
    expect(folded).toBe('ain temouchent');
  });

  it('reads hyphens, apostrophes and repeated spaces as one space and trims the ends', () => {
    // Act
    const hyphen = fold('  Tizi-Ouzou ');
    const apostrophe = fold('M’Sila');

    // Assert
    expect(hyphen).toBe('tizi ouzou');
    expect(apostrophe).toBe(fold("m'sila"));
  });

  it('ignores Arabic diacritics, the tatweel and the hamza forms of alef', () => {
    // Act
    const withHamza = fold('أدرار');
    const withTashkeel = fold('الجَزَائِر');
    const withTatweel = fold('وهـــران');

    // Assert
    expect(withHamza).toBe(fold('ادرار'));
    expect(withTashkeel).toBe(fold('الجزائر'));
    expect(withTatweel).toBe(fold('وهران'));
  });
});

describe('matchesPlaceName', () => {
  it('matches the start of the French name whatever the case', () => {
    // Act
    const matched = matchesPlaceName('ALG', alger);

    // Assert
    expect(matched).toBe(true);
  });

  it('matches the Arabic name and the other spellings', () => {
    // Act
    const byArabic = matchesPlaceName('الجزا', alger);
    const byOtherSpelling = matchesPlaceName('cheliff', chlef);

    // Assert
    expect(byArabic).toBe(true);
    expect(byOtherSpelling).toBe(true);
  });

  it('matches across accents, hyphens and apostrophes', () => {
    // Act
    const accent = matchesPlaceName('ain temou', temouchent);
    const hyphen = matchesPlaceName('tizi ouzou', tizi);
    const apostrophe = matchesPlaceName('m sila', msila);
    const hamza = matchesPlaceName('ادرار', adrar);

    // Assert
    expect([accent, hyphen, apostrophe, hamza]).toEqual([true, true, true, true]);
  });

  it('matches a word inside the name, not only its start', () => {
    // Act
    const matched = matchesPlaceName('ouzou', tizi);

    // Assert
    expect(matched).toBe(true);
  });

  it('refuses a name that does not contain the query', () => {
    // Act
    const matched = matchesPlaceName('oran', alger);

    // Assert
    expect(matched).toBe(false);
  });

  it('matches every place when the query is blank', () => {
    // Act
    const matched = matchesPlaceName('  ', alger);

    // Assert
    expect(matched).toBe(true);
  });

  it('finds every wilaya by its own French and Arabic names', () => {
    // Arrange
    const places = WILAYAS.map((wilaya): NamedPlace => ({
      name: wilaya.names?.fr ?? '',
      arabicName: wilaya.names?.ar ?? '',
      names: [],
    }));

    // Act
    const byFrench = places.filter((place) => matchesPlaceName(place.name, place));
    const byArabic = places.filter((place) => matchesPlaceName(place.arabicName, place));

    // Assert
    expect(byFrench).toHaveLength(WILAYA_COUNT);
    expect(byArabic).toHaveLength(WILAYA_COUNT);
  });
});

describe('filterByName', () => {
  it('keeps the matching places in their order', () => {
    // Arrange
    const places = [adrar, alger, chlef, tizi, msila];

    // Act
    const found = filterByName('a', places);

    // Assert
    expect(found).toEqual([adrar, alger, msila]);
  });

  it('returns every place for a blank query', () => {
    // Arrange
    const places = [adrar, alger];

    // Act
    const found = filterByName('', places);

    // Assert
    expect(found).toEqual(places);
  });
});
