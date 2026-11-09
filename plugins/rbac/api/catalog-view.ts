import { type LocalizedLabel, PERMISSION_AREAS, PERMISSION_CATALOG } from '@cod/shared';

/** French labels are deferred and fall back to English (D72), so clients always get a text. */
const withFallback = (label: LocalizedLabel): Required<LocalizedLabel> => ({ ...label, fr: label.fr ?? label.en });

/** The areas and permissions with a label in every language; GraphQL and REST answer the same value. */
export const PERMISSION_CATALOG_VIEW = {
  areas: PERMISSION_AREAS.map((area) => ({ ...area, label: withFallback(area.label) })),
  permissions: PERMISSION_CATALOG.map((entry) => ({ ...entry, label: withFallback(entry.label) })),
};
