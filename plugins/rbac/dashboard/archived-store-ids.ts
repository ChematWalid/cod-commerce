const STORE_LIST_FIELD = 'storeIds';

function isPlainObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A copy of an activity diff whose `storeIds` lists name no archived store; every other field stays as written. */
export function withoutArchivedStores(diff: unknown, archived: ReadonlySet<string>): unknown {
  if (!isPlainObject(diff)) return diff;
  return Object.fromEntries(
    Object.entries(diff).map(([field, value]) => {
      if (field === STORE_LIST_FIELD && Array.isArray(value)) {
        return [field, value.filter((id: unknown) => typeof id !== 'string' || !archived.has(id))];
      }
      return [field, withoutArchivedStores(value, archived)];
    }),
  );
}
