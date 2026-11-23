import { GEO_ERROR_CODES, WILAYA_COUNT } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ProvinceReadService } from '../../application/province-read.service';
import type { GeoSeed } from '../../domain/geo-seed';
import type { TownAvailability } from '../../domain/ports/town-availability.port';
import {
  FixedGeoReferenceReader,
  FixedTownAvailability,
  ListedServedStores,
  MapAvailabilityCache,
} from '../fakes/geo-read-fakes';

const STORE = '1000000000000001';
const REFERENCE: GeoSeed = {
  provinces: [
    { code: '16', name: 'Alger', arabicName: 'الجزائر', names: [] },
    { code: '01', name: 'Adrar', arabicName: 'أدرار', names: [] },
  ],
  towns: [
    {
      codeOns: 1601,
      provinceCode: '16',
      name: 'Alger Centre',
      arabicName: 'الجزائر الوسطى',
      names: [],
      isStopdesk: true,
      isHomeDelivery: true,
    },
    {
      codeOns: 1652,
      provinceCode: '16',
      name: 'Cheraga',
      arabicName: 'الشراقة',
      names: [],
      isStopdesk: true,
      isHomeDelivery: true,
    },
  ],
};
const NO_DESK_IN_ALGER: TownAvailability = {
  home: true,
  desk: false,
  towns: new Map([[1652, { home: false, desk: true }]]),
};

function serviceWith(answers: ReadonlyMap<string, TownAvailability> = new Map()) {
  const reader = new FixedGeoReferenceReader(REFERENCE);
  const availability = new FixedTownAvailability(answers);
  const service = new ProvinceReadService({
    reader,
    stores: new ListedServedStores([STORE]),
    availability: { current: () => availability },
    cache: new MapAvailabilityCache(),
  });
  return { service, reader, availability };
}

describe('ProvinceReadService', () => {
  it('lists the wilayas and reads the tables once per process', async () => {
    // Arrange
    const { service, reader } = serviceWith();

    // Act
    const first = await service.list();
    await service.list();
    await service.byCode('16');

    // Assert
    expect(first.map((province) => province.code)).toEqual(['01', '16']);
    expect(reader.reads).toBe(1);
  });

  it.each(['16', '1', '01'])('answers the wilaya of the code parameter %s with its two-digit code', async (raw) => {
    // Arrange
    const { service } = serviceWith();

    // Act
    const province = await service.byCode(raw);

    // Assert
    expect(province.code).toBe(raw === '16' ? '16' : '01');
  });

  it.each(['0', String(WILAYA_COUNT + 1), 'abc', '1.5', '016', '02'])(
    'refuses the code parameter %s as a province not found',
    async (raw) => {
      // Arrange
      const { service } = serviceWith();

      // Act and Assert
      await expect(service.byCode(raw)).rejects.toMatchObject({ code: GEO_ERROR_CODES.PROVINCE_NOT_FOUND });
    },
  );

  it('narrows the communes of a served store through the registered availability source', async () => {
    // Arrange
    const { service } = serviceWith(new Map([[`${STORE}:16`, NO_DESK_IN_ALGER]]));

    // Act
    const province = await service.byCodeForStore(STORE, '16', STORE);

    // Assert
    expect(
      province.towns?.map(({ codeOns, isHomeDelivery, isStopdesk }) => ({ codeOns, isHomeDelivery, isStopdesk })),
    ).toEqual([
      { codeOns: 1601, isHomeDelivery: true, isStopdesk: false },
      { codeOns: 1652, isHomeDelivery: false, isStopdesk: true },
    ]);
  });

  it('keeps the reference flags when the source does not narrow the wilaya', async () => {
    // Arrange
    const { service } = serviceWith();

    // Act
    const narrowed = await service.byCodeForStore(STORE, '16', STORE);
    const reference = await service.byCode('16');

    // Assert
    expect(narrowed).toEqual(reference);
  });

  it('asks the source once per store and wilaya while the answer is cached', async () => {
    // Arrange
    const { service, availability } = serviceWith(new Map([[`${STORE}:16`, NO_DESK_IN_ALGER]]));

    // Act
    await service.byCodeForStore(STORE, '16', STORE);
    await service.byCodeForStore(STORE, '16', STORE);

    // Assert
    expect(availability.calls).toBe(1);
  });

  it.each([
    ['an unknown id', '999'],
    ['no id', undefined],
    ['a repeated id', [STORE, STORE]],
  ])('refuses %s as a store not found, on the list and the detail', async (_label, raw) => {
    // Arrange
    const { service } = serviceWith();

    // Act and Assert
    await expect(service.listForStore(raw, raw)).rejects.toMatchObject({ code: GEO_ERROR_CODES.STORE_NOT_FOUND });
    await expect(service.byCodeForStore(raw, '16', raw)).rejects.toMatchObject({
      code: GEO_ERROR_CODES.STORE_NOT_FOUND,
    });
  });

  it.each([
    ['another store', '1000000000000002'],
    ['an empty header', ''],
    ['a repeated header', `${STORE}, ${STORE}`],
  ])('refuses a signed store header naming %s as a store not found (D3135)', async (_label, signed) => {
    // Arrange
    const { service, availability } = serviceWith(new Map([[`${STORE}:16`, NO_DESK_IN_ALGER]]));

    // Act and Assert
    await expect(service.listForStore(STORE, signed)).rejects.toMatchObject({ code: GEO_ERROR_CODES.STORE_NOT_FOUND });
    await expect(service.byCodeForStore(STORE, '16', signed)).rejects.toMatchObject({
      code: GEO_ERROR_CODES.STORE_NOT_FOUND,
    });
    expect(availability.calls).toBe(0);
  });

  it('refuses a store query without the signed store header, so a signature never reads any store (D3135)', async () => {
    // Arrange
    const { service, availability } = serviceWith(new Map([[`${STORE}:16`, NO_DESK_IN_ALGER]]));

    // Act and Assert
    await expect(service.listForStore(STORE, undefined)).rejects.toMatchObject({
      code: GEO_ERROR_CODES.STORE_NOT_FOUND,
    });
    await expect(service.byCodeForStore(STORE, '16', undefined)).rejects.toMatchObject({
      code: GEO_ERROR_CODES.STORE_NOT_FOUND,
    });
    expect(availability.calls).toBe(0);
  });

  it('serves a store whose signed store header names the same store', async () => {
    // Arrange
    const { service } = serviceWith(new Map([[`${STORE}:16`, NO_DESK_IN_ALGER]]));

    // Act
    const signed = await service.byCodeForStore(STORE, '16', STORE);

    // Assert
    expect(signed.towns?.find((town) => town.codeOns === 1652)).toMatchObject({ isHomeDelivery: false });
    await expect(service.listForStore(STORE, STORE)).resolves.toEqual(await service.list());
  });

  it('lists the same wilayas for a served store as for everyone', async () => {
    // Arrange
    const { service } = serviceWith();

    // Act and Assert
    await expect(service.listForStore(STORE, STORE)).resolves.toEqual(await service.list());
  });

  it("answers a wilaya's communes as the town directory, from the same single read", async () => {
    // Arrange
    const { service, reader } = serviceWith();

    // Act
    const alger = await service.townsOf('16');
    const adrar = await service.townsOf('01');
    await service.list();

    // Assert
    expect(alger).toEqual([1601, 1652]);
    expect(adrar).toEqual([]);
    expect(reader.reads).toBe(1);
  });

  it('answers no communes for a wilaya the reference does not hold', async () => {
    // Arrange
    const { service } = serviceWith();

    // Act and Assert
    await expect(service.townsOf('69')).resolves.toEqual([]);
  });

  it("answers a wilaya's commune by its ONS code with its reference flags, from the same single read", async () => {
    // Arrange
    const { service, reader } = serviceWith();

    // Act
    const cheraga = await service.townOf('16', 1652);
    await service.townsOf('16');

    // Assert
    expect(cheraga).toMatchObject({ codeOns: 1652, provinceCode: '16', isStopdesk: true, isHomeDelivery: true });
    expect(reader.reads).toBe(1);
  });

  it('answers no commune for an unknown code or a commune of another wilaya', async () => {
    // Arrange
    const { service } = serviceWith();

    // Act and Assert
    await expect(service.townOf('16', 999_999)).resolves.toBeUndefined();
    await expect(service.townOf('01', 1601)).resolves.toBeUndefined();
    await expect(service.townOf('69', 1601)).resolves.toBeUndefined();
  });
});
