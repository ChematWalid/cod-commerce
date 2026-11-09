import type { CredentialsFixture, StoreFixture, TwoBusinesses } from '@cod/testing';
import { createMember } from '@cod/testing';
import type { INestApplication } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { BusinessRoleEntity } from '../../infrastructure/business-role.entity';
import { AccessRows, SET_ACCESS } from './member-access-kit';
import { actAsInNewSession } from './rbac-kit';

const ROLE_FIELDS = `
  id name description builtInKey isBuiltIn permissions permissionCount memberCount updatedAt
  areaLevels { area level }
`;

export const BUSINESS_ROLES = gql`query { businessRoles { ${ROLE_FIELDS} } }`;
export const BUSINESS_ROLE = gql`query ($id: String!) { businessRole(id: $id) { ${ROLE_FIELDS} } }`;
export const CREATE_ROLE = gql`mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { ${ROLE_FIELDS} } }`;
export const UPDATE_ROLE = gql`mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { ${ROLE_FIELDS} } }`;
export const DELETE_ROLE = gql`
  mutation ($id: String!) {
    deleteBusinessRole(id: $id) {
      success
    }
  }
`;
export const DUPLICATE_ROLE = gql`mutation ($id: String!, $locale: String) { duplicateBusinessRole(id: $id, locale: $locale) { ${ROLE_FIELDS} } }`;
export const PERMISSION_CATALOG_QUERY = gql`
  query {
    permissionCatalog {
      areas {
        id
        order
        label {
          en
          ar
          fr
        }
      }
      permissions {
        key
        area
        level
        sensitive
        label {
          en
          ar
          fr
        }
      }
    }
  }
`;
export const EFFECTIVE_PERMISSIONS = gql`
  query {
    effectivePermissions {
      storeId
      permissions
      storeAccess
    }
  }
`;

export interface RoleAnswer {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly builtInKey: string | null;
  readonly isBuiltIn: boolean;
  readonly permissions: readonly string[];
  readonly permissionCount: number;
  readonly memberCount: number;
  readonly areaLevels: readonly { readonly area: string; readonly level: string }[];
}

export interface RoleInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly startFromRoleId?: string;
  readonly areaLevels?: readonly { readonly area: string; readonly level: string }[];
  readonly grants?: readonly string[];
  readonly revokes?: readonly string[];
}

/** The role operations as one member calls them. */
export class RoleApi {
  constructor(private readonly client: SimpleGraphQLClient) {}

  async create(input: RoleInput): Promise<RoleAnswer> {
    const answer = await this.client.query<{ createBusinessRole: RoleAnswer }>(CREATE_ROLE, { input });
    return answer.createBusinessRole;
  }

  async update(id: string, input: RoleInput): Promise<RoleAnswer> {
    const answer = await this.client.query<{ updateBusinessRole: RoleAnswer }>(UPDATE_ROLE, { id, input });
    return answer.updateBusinessRole;
  }

  remove(id: string): Promise<unknown> {
    return this.client.query(DELETE_ROLE, { id });
  }

  async duplicate(id: string, locale?: string): Promise<RoleAnswer> {
    const answer = await this.client.query<{ duplicateBusinessRole: RoleAnswer }>(DUPLICATE_ROLE, { id, locale });
    return answer.duplicateBusinessRole;
  }

  async get(id: string): Promise<RoleAnswer | null> {
    const answer = await this.client.query<{ businessRole: RoleAnswer | null }>(BUSINESS_ROLE, { id });
    return answer.businessRole;
  }

  async list(): Promise<readonly RoleAnswer[]> {
    return (await this.client.query<{ businessRoles: readonly RoleAnswer[] }>(BUSINESS_ROLES)).businessRoles;
  }
}

/** Members of one business, created and assigned for a test. */
export class RoleTeam {
  readonly rows: AccessRows;
  private counter = 0;

  constructor(
    private readonly app: INestApplication,
    private readonly client: SimpleGraphQLClient,
    private readonly businesses: TwoBusinesses,
    private readonly prefix: string,
  ) {
    this.rows = new AccessRows(app);
  }

  get home(): StoreFixture {
    return this.businesses.a.stores[0];
  }

  get other(): StoreFixture {
    return this.businesses.a.stores[1];
  }

  asOwner(store: StoreFixture = this.home): Promise<string> {
    return actAsInNewSession(this.client, this.businesses.a.owner, store);
  }

  /** A member of business A with no role of ours yet. */
  async member(): Promise<{ credentials: CredentialsFixture; id: string }> {
    this.counter += 1;
    const credentials = await createMember(this.app, this.client, {
      code: `${this.prefix}-${String(this.counter)}`,
      business: this.businesses.a,
      store: this.home,
      permissions: ['Authenticated'],
    });
    return { credentials, id: await this.rows.administratorId(credentials) };
  }

  /** Signed in as the owner, gives the member these roles on these stores, or on all of them when none is named. */
  async assign(id: string, roleIds: readonly string[], stores?: readonly StoreFixture[]): Promise<void> {
    await this.asOwner();
    await this.client.query(SET_ACCESS, {
      input: {
        administratorId: id,
        roleIds,
        storeAccess: stores === undefined ? 'all' : 'selected',
        storeIds: stores?.map((store) => store.id) ?? [],
      },
    });
  }

  /** A new member holding these roles, signed in on `store`. */
  async signedInMember(
    roleIds: readonly string[],
    stores: readonly StoreFixture[] | undefined,
    store: StoreFixture = this.home,
  ): Promise<{ credentials: CredentialsFixture; id: string; token: string }> {
    const member = await this.member();
    await this.assign(member.id, roleIds, stores);
    return { ...member, token: await actAsInNewSession(this.client, member.credentials, store) };
  }

  /** Permissions of the role row, as stored. */
  async storedPermissions(id: string): Promise<readonly string[]> {
    const repository = this.app.get(TransactionalConnection).rawConnection.getRepository(BusinessRoleEntity);
    return (await repository.findOneByOrFail({ id })).permissions;
  }
}

export const allStoresRole = (name: string, areas: Readonly<Record<string, string>>): RoleInput => ({
  name,
  areaLevels: Object.entries(areas).map(([area, level]) => ({ area, level })),
});
