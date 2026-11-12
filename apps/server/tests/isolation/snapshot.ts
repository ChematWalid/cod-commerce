import { dataOf, type IsolationHttp } from './http';
import { ownChannel } from './matrix';
import type { BusinessWorld } from './world';

/** What the victim's owner reads of its own business; any change across the attacks is a cross-business write. */
const SNAPSHOT = `query ($member: String!) {
  activeBusiness { id name }
  stores { id name subdomain status }
  businessRoles { id name permissions }
  memberAccess(administratorId: $member) { roles { id } storeAccess storeIds }
  tenantSecrets { id ref last4 updatedAt }
  templateNotes { id title }
  accountProfile { lastName }
}`;

/** The victim's business as its owner sees it, sorted so the comparison ignores order. */
export async function snapshotOf(http: IsolationHttp, business: BusinessWorld): Promise<unknown> {
  const data = dataOf(
    await http.graphql(business.owner, SNAPSHOT, { member: business.member.administratorId }, ownChannel(business)),
  );
  return JSON.parse(JSON.stringify(data, (_key, value: unknown) => (Array.isArray(value) ? sorted(value) : value)));
}

const sorted = (values: unknown[]): unknown[] =>
  [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
