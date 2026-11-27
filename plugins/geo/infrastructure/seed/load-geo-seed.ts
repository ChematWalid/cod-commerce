import { provinceSchema, townSchema } from '@cod/shared';
import { z } from 'zod';
import type { GeoSeed } from '../../domain/geo-seed';
// A JSON import, never an fs read, so the seed ships in `dist` and the migrate image (D3116). This module is not
// named `geo-seed.ts`: Node resolves `./geo-seed` to the `.json` file before a `.ts` one.
import seedFile from './geo-seed.json';

/** The shape of `geo-seed.json`: the API shapes without their derived ids. */
const geoSeedFileSchema = z.object({
  provinces: z.array(provinceSchema.omit({ id: true, towns: true })),
  towns: z.array(townSchema.omit({ id: true })),
});

/**
 * The wilayas and communes of `geo-seed.json`, checked against the shared schemas.
 * @throws {z.ZodError} when the file breaks the schemas: the boot fails instead of seeding bad rows.
 */
export function loadGeoSeed(): GeoSeed {
  return geoSeedFileSchema.parse(seedFile);
}
