import type { PermissionArea } from './areas';
import type { PermissionKey } from './catalog';

/** What a permission lets someone do: look only, or change things. */
export type PermissionLevel = 'view' | 'full';

/** The level of a whole area on a role: nothing, look only, or everything. */
export type AreaLevel = 'none' | 'view' | 'full';

/** Display text. `fr` is optional and falls back to `en` (D72). */
export interface LocalizedLabel {
  readonly en: string;
  readonly ar: string;
  readonly fr?: string;
}

/** A permission as declared in the catalog files, with literal key and area types. */
export interface PermissionDefinition<K extends string = string, A extends PermissionArea = PermissionArea> {
  readonly key: K;
  readonly area: A;
  readonly level: PermissionLevel;
  /** Needs an explicit choice: never part of a "View" area level (D62). */
  readonly sensitive: boolean;
  readonly label: LocalizedLabel;
}

/** One entry of {@link PERMISSION_CATALOG}. */
export type PermissionDefinitionEntry = PermissionDefinition<PermissionKey>;
