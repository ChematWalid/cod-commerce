import { Inject, Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { GeoSeed } from '../domain/geo-seed';
import type { GeoReferenceReader } from '../domain/ports/geo-reference-reader.port';
import { GeoProvinceEntity } from './province.entity';
import { GeoTownEntity } from './town.entity';

/**
 * {@link GeoReferenceReader} on `geo_province` and `geo_town`, global reference tables with no tenant (D3103): this
 * file is on the raw-data allow-list for that reason (D3130). Two reads of every row, once per process.
 */
@Injectable()
export class TypeOrmGeoReferenceReader implements GeoReferenceReader {
  constructor(@Inject(TransactionalConnection) private readonly connection: TransactionalConnection) {}

  async read(): Promise<GeoSeed> {
    const { rawConnection } = this.connection;
    const [provinces, towns] = await Promise.all([
      rawConnection.getRepository(GeoProvinceEntity).find({ order: { code: 'ASC' } }),
      rawConnection.getRepository(GeoTownEntity).find({ order: { codeOns: 'ASC' } }),
    ]);
    return {
      provinces: provinces.map(({ code, name, arabicName, names }) => ({ code, name, arabicName, names })),
      towns: towns.map(({ codeOns, provinceCode, name, arabicName, names, isStopdesk, isHomeDelivery }) => ({
        codeOns,
        provinceCode,
        name,
        arabicName,
        names,
        isStopdesk,
        isHomeDelivery,
      })),
    };
  }
}
