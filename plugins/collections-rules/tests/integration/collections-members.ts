import { randomBytes } from 'node:crypto';
import type { PermissionKey } from '@cod/shared';
import { type BusinessFixture, createMember } from '@cod/testing';
import type { CollectionsKit } from './collections-kit';

const CREATE_ROLE = `mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id } }`;
const SET_ACCESS = `mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId } }`;

/**
 * Members holding exactly a set of grants, through rbac's API as the owner (pattern of the catalog kit). A business
 * may hold only so many custom roles, so a role is made once per grant set.
 */
export class CollectionsMembers {
  private readonly roles = new Map<string, string>();

  constructor(private readonly kit: CollectionsKit) {}

  /** Signs in, on the business's first store, as a new member whose one role holds exactly `grants` (none: no role). */
  async signInAsMember(business: BusinessFixture, grants: readonly PermissionKey[]): Promise<void> {
    const member = await createMember(this.kit.app, this.kit.client, {
      code: `m-${randomBytes(4).toString('hex')}`,
      business,
      store: business.stores[0],
      permissions: [],
    });
    const [row] = await this.kit.query<{ id: number }>('SELECT id FROM administrator WHERE "emailAddress" = $1', [
      member.email,
    ]);
    await this.kit.asOwner(business);
    const roleIds = grants.length === 0 ? [] : [await this.roleWith(business, grants)];
    await this.kit.gql(SET_ACCESS, {
      input: { administratorId: String(row?.id), roleIds, storeAccess: 'all', storeIds: [] },
    });
    await this.kit.signIn(member, business.stores[0]);
  }

  private async roleWith(business: BusinessFixture, grants: readonly PermissionKey[]): Promise<string> {
    const key = `${business.businessId}:${[...grants].sort().join(',')}`;
    const cached = this.roles.get(key);
    if (cached !== undefined) return cached;
    const { createBusinessRole } = await this.kit.gql<{ createBusinessRole: { id: string } }>(CREATE_ROLE, {
      input: { name: `Role ${randomBytes(4).toString('hex')}`, grants },
    });
    this.roles.set(key, createBusinessRole.id);
    return createBusinessRole.id;
  }
}
