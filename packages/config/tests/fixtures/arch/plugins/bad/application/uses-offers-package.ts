import { offersEntry } from '@cod/plugin-offers';

/** Forbidden: application/ declares ports, it never imports the offers entry (D2402). */
export const offersInApplication = offersEntry;
