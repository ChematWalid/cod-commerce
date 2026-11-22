import { WILAYA_CODES, WILAYA_COUNT, WILAYAS, type WilayaCode } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import law from '../../../../scripts/geo/law-26-06-articles.json';
import type { TownSeed } from '../../domain/geo-seed';
import { loadGeoSeed } from '../../infrastructure/seed/load-geo-seed';

/** The official commune count of law 26-06 (D3102, D3123): ONS did not add or remove any. */
const COMMUNE_COUNT = 1541;

const seed = loadGeoSeed();
const townsOf = (code: WilayaCode): readonly TownSeed[] => seed.towns.filter((town) => town.provinceCode === code);
const townByOns = new Map(seed.towns.map((town) => [town.codeOns, town]));

describe('geo seed data', () => {
  it('holds every wilaya once, in code order', () => {
    // Act
    const codes = seed.provinces.map((province) => province.code);

    // Assert
    expect(seed.provinces).toHaveLength(WILAYA_COUNT);
    expect(codes).toEqual([...WILAYA_CODES]);
  });

  it('holds the official number of communes, each ONS code once', () => {
    // Act
    const codes = new Set(seed.towns.map((town) => town.codeOns));

    // Assert
    expect(seed.towns).toHaveLength(COMMUNE_COUNT);
    expect(codes.size).toBe(COMMUNE_COUNT);
  });

  it('gives every wilaya at least one commune and one stop desk', () => {
    // Act
    const lacking = WILAYA_CODES.filter((code) => {
      const towns = townsOf(code);
      return towns.length === 0 || !towns.some((town) => town.isStopdesk);
    });

    // Assert
    expect(lacking).toEqual([]);
  });

  it.each(law.articles.map((article) => [article.wilaya, article.article, article.communes.length] as const))(
    'gives wilaya %s the communes of law 26-06 article %s (%i)',
    (wilaya, _article, count) => {
      // Act
      const towns = townsOf(wilaya as WilayaCode);

      // Assert
      expect(towns).toHaveLength(count);
    },
  );

  it('names every wilaya as the shared WILAYAS table does', () => {
    // Act
    const names = seed.provinces.map((province) => ({
      code: province.code,
      names: { ar: province.arabicName, fr: province.name },
    }));

    // Assert
    expect(names).toEqual(WILAYAS);
  });

  it.each([
    [1601, '16', 'Alger Centre', 'الجزائر الوسطى'],
    [1652, '16', 'Cheraga', 'الشراقة'],
    [3101, '31', 'Oran', 'وهران'],
    [1101, '11', 'Tamanrasset', 'تمنراست'],
    [2501, '25', 'Constantine', 'قسنطينة'],
    [1501, '15', 'Tizi-Ouzou', 'تيزي وزو'],
    [109, '49', 'Timimoun', 'تيميمون'],
    [3013, '55', 'Touggourt', 'تقرت'],
    [4711, '58', 'Hassi Fehal', 'حاسي الفحل'],
    [3207, '69', 'El Abiodh Sidi Cheikh', 'الأبيض سيدي الشيخ'],
    [2801, '28', "M'Sila", 'المسيلة'],
    [2820, '68', 'Bou Saada', 'بوسعادة'],
    [1731, '65', 'Ain Oussera', 'عين وسارة'],
  ] as const)('places commune %i in wilaya %s as %s / %s', (codeOns, provinceCode, name, arabicName) => {
    // Act
    const town = townByOns.get(codeOns);

    // Assert
    expect(town).toMatchObject({ provinceCode, name, arabicName });
  });
});
