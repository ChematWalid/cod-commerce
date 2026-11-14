import { offersEntry } from '@cod/plugin-offers';

/** Refused: a frontend is an API client and never imports the offers' server services (ADR 0017, D2402). */
export const leaked = offersEntry;
