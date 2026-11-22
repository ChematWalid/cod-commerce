import { Inject, Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { EntityManager, ObjectLiteral } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { GEO_SEED_CHUNK_SIZE } from '../domain/constants';
import type { GeoSeed, GeoSeedCounts } from '../domain/geo-seed';
import type { GeoSeedStore } from '../domain/ports/geo-seed-store.port';
import { chunksOf } from '../domain/seed-chunks';
import { GeoProvinceEntity } from './province.entity';
import { GeoTownEntity } from './town.entity';

/** Where one upsert writes: the table, its key, and the columns a converge refreshes on an existing row. */
interface UpsertTarget<Row extends ObjectLiteral> {
  readonly entity: new () => Row;
  readonly key: keyof Row & string;
  readonly updated: readonly (keyof Row & string)[];
}

const PROVINCES: UpsertTarget<GeoProvinceEntity> = {
  entity: GeoProvinceEntity,
  key: 'code',
  updated: ['name', 'arabicName', 'names'],
};

const TOWNS: UpsertTarget<GeoTownEntity> = {
  entity: GeoTownEntity,
  key: 'codeOns',
  updated: ['provinceCode', 'name', 'arabicName', 'names', 'isStopdesk', 'isHomeDelivery'],
};

/**
 * {@link GeoSeedStore} on `geo_province` and `geo_town`, global reference tables with no tenant (D3103): this file is
 * on the raw-data allow-list for that reason. Multi-row `INSERT … ON CONFLICT (key) DO UPDATE`, wilayas first for the
 * foreign key, in one transaction.
 */
@Injectable()
export class TypeOrmGeoSeedStore implements GeoSeedStore {
  constructor(@Inject(TransactionalConnection) private readonly connection: TransactionalConnection) {}

  upsert(seed: GeoSeed): Promise<GeoSeedCounts> {
    return this.connection.rawConnection.transaction(async (manager) => {
      for (const rows of chunksOf(seed.provinces, GEO_SEED_CHUNK_SIZE)) {
        await upsertRows(manager, PROVINCES, rows);
      }
      for (const rows of chunksOf(seed.towns, GEO_SEED_CHUNK_SIZE)) {
        await upsertRows(manager, TOWNS, rows);
      }
      return { provinces: seed.provinces.length, towns: seed.towns.length };
    });
  }
}

/** One multi-row upsert of `rows` into the target's table, refreshing its columns on a key conflict. */
async function upsertRows<Row extends ObjectLiteral>(
  manager: EntityManager,
  target: UpsertTarget<Row>,
  rows: readonly QueryDeepPartialEntity<Row>[],
): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(target.entity)
    .values([...rows])
    .orUpdate([...target.updated], [target.key])
    .execute();
}
