import type { INestApplication } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import { restCall, type RestRequest } from './rbac-kit';
import {
  BUSINESS_ROLE,
  BUSINESS_ROLES,
  CREATE_ROLE,
  DELETE_ROLE,
  DUPLICATE_ROLE,
  EFFECTIVE_PERMISSIONS,
  PERMISSION_CATALOG_QUERY,
  type RoleAnswer,
  type RoleInput,
  UPDATE_ROLE,
} from './roles-kit';

const NO_CODE = 'NO_CODE';
const FORBIDDEN_STATUS = 403;

/** What a call answered, the same shape over GraphQL and REST: no `code` means it succeeded. */
export interface Outcome {
  readonly code: string | undefined;
  /** The HTTP status of a REST call; GraphQL answers carry none. */
  readonly status: number | undefined;
  readonly data: unknown;
}

/** The role and permission operations of one API surface. */
export interface RoleSurface {
  readonly name: 'graphql' | 'rest';
  list(): Promise<Outcome>;
  get(id: string): Promise<Outcome>;
  create(input: RoleInput): Promise<Outcome>;
  update(id: string, input: RoleInput): Promise<Outcome>;
  remove(id: string): Promise<Outcome>;
  duplicate(id: string): Promise<Outcome>;
  catalog(): Promise<Outcome>;
  effective(): Promise<Outcome>;
}

interface ClientErrorShape {
  readonly response?: { readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[] };
}

/** Runs a GraphQL call and unwraps its one root field; a refusal becomes the code of its first error. */
export async function graphqlOutcome(call: Promise<Record<string, unknown>>): Promise<Outcome> {
  try {
    return { code: undefined, status: undefined, data: Object.values(await call)[0] };
  } catch (error: unknown) {
    const code = (error as ClientErrorShape).response?.errors?.[0]?.extensions?.code ?? NO_CODE;
    return { code, status: undefined, data: null };
  }
}

/** The role operations over the Admin API, as the signed-in client calls them. */
export function graphqlSurface(client: SimpleGraphQLClient): RoleSurface {
  return {
    name: 'graphql',
    list: () => graphqlOutcome(client.query(BUSINESS_ROLES)),
    get: (id) => graphqlOutcome(client.query(BUSINESS_ROLE, { id })),
    create: (input) => graphqlOutcome(client.query(CREATE_ROLE, { input })),
    update: (id, input) => graphqlOutcome(client.query(UPDATE_ROLE, { id, input })),
    remove: (id) => graphqlOutcome(client.query(DELETE_ROLE, { id })),
    duplicate: (id) => graphqlOutcome(client.query(DUPLICATE_ROLE, { id })),
    catalog: () => graphqlOutcome(client.query(PERMISSION_CATALOG_QUERY)),
    effective: () => graphqlOutcome(client.query(EFFECTIVE_PERMISSIONS)),
  };
}

async function rest(
  server: { readonly app: INestApplication },
  client: SimpleGraphQLClient,
  request: RestRequest,
): Promise<Outcome> {
  const answer = await restCall(server.app, client, request);
  if (answer.status < 400) return { code: undefined, status: answer.status, data: answer.body };
  const code = (answer.body as { code?: string } | null)?.code;
  return {
    code: code ?? (answer.status === FORBIDDEN_STATUS ? 'FORBIDDEN' : NO_CODE),
    status: answer.status,
    data: null,
  };
}

/** The same operations over REST; the server is read at call time, because a test file starts it in `beforeAll`. */
export function restSurface(server: { readonly app: INestApplication }, client: SimpleGraphQLClient): RoleSurface {
  return {
    name: 'rest',
    list: () => rest(server, client, { method: 'GET', path: '/roles' }),
    get: (id) => rest(server, client, { method: 'GET', path: `/roles/${id}` }),
    create: (input) => rest(server, client, { method: 'POST', path: '/roles', body: input }),
    update: (id, input) => rest(server, client, { method: 'PATCH', path: `/roles/${id}`, body: input }),
    remove: (id) => rest(server, client, { method: 'DELETE', path: `/roles/${id}` }),
    duplicate: (id) => rest(server, client, { method: 'POST', path: `/roles/${id}/duplicate`, body: {} }),
    catalog: () => rest(server, client, { method: 'GET', path: '/permissions/catalog' }),
    effective: () => rest(server, client, { method: 'GET', path: '/permissions' }),
  };
}

export const rolesOf = (outcome: Outcome): readonly RoleAnswer[] => outcome.data as RoleAnswer[];
export const roleOf = (outcome: Outcome): RoleAnswer => outcome.data as RoleAnswer;

/** Everything one business holds in the RBAC tables and in the Vendure roles they project. */
export interface BusinessSnapshot {
  readonly roles: readonly unknown[];
  readonly bindings: readonly unknown[];
  readonly assignments: readonly unknown[];
  readonly vendureRoles: readonly unknown[];
  readonly activity: readonly unknown[];
}

/** Reads the rows straight from the database, so a change cannot hide behind an API. */
export class BusinessRows {
  constructor(private readonly server: { readonly app: INestApplication }) {}

  private query(sql: string, ...parameters: string[]): Promise<unknown[]> {
    return this.server.app.get(TransactionalConnection).rawConnection.query<unknown[]>(sql, parameters);
  }

  async snapshot(businessId: string): Promise<BusinessSnapshot> {
    const rows = (table: string): Promise<unknown[]> =>
      this.query(`SELECT * FROM "${table}" WHERE "businessId" = $1 ORDER BY "id"`, businessId);
    return {
      roles: await rows('business_role'),
      bindings: await rows('role_binding'),
      assignments: await rows('member_role_assignment'),
      vendureRoles: await this.query(
        `SELECT r."id", r."code", r."permissions" FROM "role" r WHERE r."id" IN
           (SELECT "vendureRoleId" FROM "role_binding" WHERE "businessId" = $1) ORDER BY r."id"`,
        businessId,
      ),
      activity: await rows('activity_log'),
    };
  }

  async roleIds(businessId: string): Promise<string[]> {
    const rows = (await this.query(`SELECT "id" FROM "business_role" WHERE "businessId" = $1`, businessId)) as {
      id: string;
    }[];
    return rows.map(({ id }) => id);
  }

  async roleNamed(businessId: string, id: string): Promise<{ name: string } | undefined> {
    const rows = (await this.query(
      `SELECT "name" FROM "business_role" WHERE "businessId" = $1 AND "id" = $2`,
      businessId,
      id,
    )) as { name: string }[];
    return rows[0];
  }

  async activityEntityIds(businessId: string): Promise<string[]> {
    const rows = (await this.query(`SELECT "entityId" FROM "activity_log" WHERE "businessId" = $1`, businessId)) as {
      entityId: string;
    }[];
    return rows.map(({ entityId }) => entityId);
  }

  async assignedRoleIds(businessId: string, administratorId: string): Promise<string[]> {
    const rows = (await this.query(
      `SELECT "businessRoleId" FROM "member_role_assignment" WHERE "businessId" = $1 AND "administratorId" = $2 ORDER BY "id"`,
      businessId,
      administratorId,
    )) as { businessRoleId: string }[];
    return rows.map(({ businessRoleId }) => businessRoleId);
  }
}
