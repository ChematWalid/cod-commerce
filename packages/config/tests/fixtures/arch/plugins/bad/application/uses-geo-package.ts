import { geoEntry } from '@cod/plugin-geo';

/** Forbidden: application/ declares ports, it never imports the geo entry (D3118). */
export const geoInApplication = geoEntry;
