import type { CatalogOrderManagerDto } from '../dto';

/**
 * The members the editor offers as order managers of a product of `storeId`: those who reach that store (the server
 * refuses the others, D2114), plus any already chosen, so a member who lost access can still be unticked.
 */
export function orderManagerChoices(
  members: readonly CatalogOrderManagerDto[],
  storeId: string,
  selected: readonly string[],
): readonly CatalogOrderManagerDto[] {
  return members.filter(
    (member) => member.storeAccess === 'all' || member.storeIds.includes(storeId) || selected.includes(member.id),
  );
}
