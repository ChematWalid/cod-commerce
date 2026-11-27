import { GeoProvinceEntity } from './province.entity';
import { GeoTownEntity } from './town.entity';

/** The geo plugin's tables, in the order their foreign keys need. */
export const GEO_ENTITIES = [GeoProvinceEntity, GeoTownEntity];
