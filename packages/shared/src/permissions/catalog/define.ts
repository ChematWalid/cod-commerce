import type { PermissionArea } from '../areas';
import type { PermissionDefinition } from '../types';

type KeyOf<A extends PermissionArea> = `${A}.${string}`;

/**
 * Declares permissions of one area. The key must start with the area id, which the
 * type checks. `view` reads, `full` changes, `sensitive` changes something destructive
 * or private and is never granted by an area's "View" level.
 */
export function definitionsFor<A extends PermissionArea>(area: A) {
  const make =
    (level: 'view' | 'full', sensitive: boolean) =>
    <K extends KeyOf<A>>(key: K, en: string, ar: string): PermissionDefinition<K, A> => ({
      key,
      area,
      level,
      sensitive,
      label: { en, ar },
    });
  return { view: make('view', false), full: make('full', false), sensitive: make('full', true) };
}
