import { describe, expect, it } from 'vitest';
import { GeoSeedService } from '../../application/geo-seed.service';
import type { GeoSeed } from '../../domain/geo-seed';
import { InMemoryGeoSeedStore } from '../fakes/in-memory-geo-seed-store';

const SEED: GeoSeed = {
  provinces: [{ code: '16', name: 'Alger', arabicName: 'الجزائر', names: ['Algiers'] }],
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
  ],
};

const serviceOver = (store: InMemoryGeoSeedStore, messages: string[]): GeoSeedService =>
  new GeoSeedService(store, SEED, { info: (message) => messages.push(message) });

describe('GeoSeedService', () => {
  it('upserts every province and town of the seed and reports the counts', async () => {
    // Arrange
    const store = new InMemoryGeoSeedStore();
    const messages: string[] = [];

    // Act
    const report = await serviceOver(store, messages).converge();

    // Assert
    expect(report).toEqual({ provinces: 1, towns: 1 });
    expect([...store.provinces.keys()]).toEqual(['16']);
    expect([...store.towns.keys()]).toEqual([1601]);
    expect(messages).toEqual(['Geo seed: 1 wilayas and 1 communes converged']);
  });

  it('leaves the same rows after a second run', async () => {
    // Arrange
    const store = new InMemoryGeoSeedStore();
    const service = serviceOver(store, []);
    await service.converge();

    // Act
    await service.converge();

    // Assert
    expect(store.provinces.size).toBe(1);
    expect(store.towns.size).toBe(1);
  });
});
