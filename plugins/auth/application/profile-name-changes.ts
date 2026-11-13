/** The names a profile save may change; an absent name is kept. */
export interface NameChanges {
  readonly firstName?: string;
  readonly lastName?: string;
}

/** Placeholder with the current behaviour (no check), replaced by the AUTH-1 fix. */
export function parseNameChanges(changes: NameChanges): NameChanges {
  return changes;
}
