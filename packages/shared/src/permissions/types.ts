import type { PermissionArea } from './areas';
import type { LocalizedLabel } from './localized-label';

/** What a permission lets someone do: look only, or change things. */
export type PermissionLevel = 'view' | 'full';

/** The level of a whole area on a role: nothing, look only, or everything. */
export type AreaLevel = 'none' | 'view' | 'full';

/** A permission as declared in the catalog files, with literal key and area types. */
export interface PermissionDefinition<K extends string = string, A extends PermissionArea = PermissionArea> {
  readonly key: K;
  readonly area: A;
  readonly level: PermissionLevel;
  /** Needs an explicit choice: never part of a "View" area level (D62). */
  readonly sensitive: boolean;
  readonly label: LocalizedLabel;
}
