import { dataOf, type IsolationHttp } from './http';
import { ownChannel } from './matrix';
import type { BusinessWorld } from './world-types';

/** What the victim's owner reads of its own business; any change across the attacks is a cross-business write. */
const snapshotQuery = (extraFields: string): string => `query ($member: String!) {
  activeBusiness { id name }
  stores { id name subdomain status }
  businessRoles { id name permissions }
  memberAccess(administratorId: $member) { roles { id } storeAccess storeIds }
  tenantSecrets { id ref last4 updatedAt }
  templateNotes { id title }
  accountProfile { lastName }
  teamMembers(input: { tab: all }) { items { id email status baseSalary commissionConfigIds } }
  teamCommissionConfigs { id name value }
  ${extraFields}
}`;

/**
 * The victim's business as its owner sees it, sorted so the comparison ignores order. `extraFields` adds what a later
 * matrix covers (the P2 catalog's `CATALOG_SNAPSHOT_FIELDS`).
 */
export async function snapshotOf(http: IsolationHttp, business: BusinessWorld, extraFields = ''): Promise<unknown> {
  const variables = { member: business.member.administratorId };
  const data = dataOf(await http.graphql(business.owner, snapshotQuery(extraFields), variables, ownChannel(business)));
  return JSON.parse(JSON.stringify(data, (_key, value: unknown) => (Array.isArray(value) ? sorted(value) : value)));
}

const sorted = (values: unknown[]): unknown[] =>
  [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
