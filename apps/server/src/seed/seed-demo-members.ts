import { MemberAccessService, asOperationContext as rbacOperationContext, CreateRoleService } from '@cod/plugin-rbac';
import { asOperationContext, BusinessStoreDirectory } from '@cod/plugin-tenancy';
import { type PermissionKey, type StoreId, toBusinessId } from '@cod/shared';
import type { INestApplicationContext } from '@nestjs/common';
import {
  Administrator,
  AdministratorService,
  Permission,
  type RequestContext,
  RoleService,
  TransactionalConnection,
} from '@vendure/core';

/** A synthetic member of the Demo business: invitations arrive in P1.S4, and the browser checks need one now. */
interface DemoMember {
  readonly emailAddress: string;
  readonly firstName: string;
  readonly roleName: string;
  readonly grants: readonly PermissionKey[];
  /** `selected` reaches the business's first store only, so another store can be proven refused. */
  readonly storeAccess: 'all' | 'selected';
  /** Also signed in on the business's second store, where `grants` do not apply: its role differs per store. */
  readonly bareOnSecondStore?: true;
}

/** Can read roles and the activity log, and change nothing. */
export const DEMO_LIMITED_MEMBER_EMAIL = 'limited@demo.example.test';
/** Holds no team permission at all. */
export const DEMO_ORDERS_MEMBER_EMAIL = 'orders@demo.example.test';
/** Holds no view permission, so the merchant sidebar shows Home alone. */
export const DEMO_NO_VIEW_MEMBER_EMAIL = 'noview@demo.example.test';
/** Can view products on the first store only, and is a member of the second store without that key. */
export const DEMO_PER_STORE_MEMBER_EMAIL = 'perstore@demo.example.test';

const DEMO_MEMBERS: readonly DemoMember[] = [
  {
    emailAddress: DEMO_LIMITED_MEMBER_EMAIL,
    firstName: 'Limited',
    roleName: 'Demo viewer',
    grants: ['team.roles.view', 'settings.activity-log.view'],
    storeAccess: 'selected',
  },
  {
    emailAddress: DEMO_ORDERS_MEMBER_EMAIL,
    firstName: 'Orders',
    roleName: 'Demo orders clerk',
    grants: ['orders.view'],
    storeAccess: 'all',
  },
  {
    emailAddress: DEMO_NO_VIEW_MEMBER_EMAIL,
    firstName: 'NoView',
    roleName: 'Demo no view',
    grants: [],
    storeAccess: 'all',
  },
  {
    emailAddress: DEMO_PER_STORE_MEMBER_EMAIL,
    firstName: 'PerStore',
    roleName: 'Demo first store catalog',
    grants: ['catalog.products.view'],
    storeAccess: 'selected',
    bareOnSecondStore: true,
  },
];

/** Who the seed acts as: the business's owner, so the escalation rules hold for seeded rows too. */
interface OwnerActor {
  readonly administratorId: number;
  readonly businessId: string;
}

/** One member's run: the same transaction for every write. */
interface SeedRun {
  readonly app: INestApplicationContext;
  readonly ctx: RequestContext;
  readonly owner: OwnerActor;
  readonly password: string;
}

const NO_ORIGIN = { ip: null, userAgent: null };

async function storesInOrder({ app, ctx, owner }: SeedRun): Promise<readonly StoreId[]> {
  const stores = await app
    .get(BusinessStoreDirectory)
    .storesOf(asOperationContext(ctx), toBusinessId(owner.businessId));
  return stores.map((store) => store.id).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
}

async function createCustomRole(run: SeedRun, member: DemoMember, storeIds: readonly StoreId[]): Promise<string> {
  const { app, ctx, owner } = run;
  const [activeStoreId] = storeIds;
  if (activeStoreId === undefined) throw new Error(`The business ${owner.businessId} has no store`);
  const actor = {
    administratorId: owner.administratorId,
    tenant: { businessId: toBusinessId(owner.businessId), storeIds, activeStoreId },
    ...NO_ORIGIN,
  };
  const command = {
    name: member.roleName,
    description: null,
    startFromRoleId: null,
    areaLevels: [],
    grants: member.grants,
    revokes: [],
  };
  return (await app.get(CreateRoleService).create(rbacOperationContext(ctx), actor, command)).id;
}

async function createAdministrator(run: SeedRun, member: DemoMember): Promise<number> {
  const { app, ctx, owner, password } = run;
  const { emailAddress, firstName } = member;
  const input = { emailAddress, firstName, lastName: 'Member', password, roleIds: [] };
  const created = await app.get(AdministratorService).create(ctx, input);
  // The tenant link is an internal custom field, which no input can set.
  await app
    .get(TransactionalConnection)
    .getRepository(ctx, Administrator)
    .update(created.id, { customFields: { businessId: owner.businessId } });
  return created.id as number;
}

async function createMember(run: SeedRun, member: DemoMember): Promise<void> {
  const { app, ctx, owner } = run;
  const storeIds = await storesInOrder(run);
  const roleId = await createCustomRole(run, member, storeIds);
  const administratorId = await createAdministrator(run, member);
  await app.get(MemberAccessService).setAccess(rbacOperationContext(ctx), {
    actor: {
      administratorId: owner.administratorId,
      scope: { businessId: toBusinessId(owner.businessId) },
      ...NO_ORIGIN,
    },
    administratorId,
    roleIds: [roleId],
    storeAccess: member.storeAccess,
    storeIds: member.storeAccess === 'selected' ? storeIds.slice(0, 1) : [],
  });
  if (member.bareOnSecondStore) await addBareRoleOnSecondStore(run, administratorId, storeIds);
}

/**
 * Puts the member on the second store with no permission beyond signing in. `setAccess` applies one set of roles to
 * every selected store, so the case of a role that differs per store needs an engine role written directly.
 */
async function addBareRoleOnSecondStore(
  { app, ctx, owner }: SeedRun,
  administratorId: number,
  storeIds: readonly StoreId[],
): Promise<void> {
  const second = storeIds[1];
  const stores = await app
    .get(BusinessStoreDirectory)
    .storesOf(asOperationContext(ctx), toBusinessId(owner.businessId));
  const channelId = stores.find((store) => store.id === second)?.channelId;
  if (channelId === undefined) throw new Error(`The business ${owner.businessId} has no second store`);
  const role = await app.get(RoleService).create(ctx, {
    code: `demo-bare-${String(administratorId)}`,
    description: 'Demo member: signed in on the second store only',
    permissions: [Permission.Authenticated],
    channelIds: [channelId],
  });
  await app.get(AdministratorService).assignRole(ctx, administratorId, role.id);
}

/**
 * Gives the business of `ownerEmail` its synthetic members, each with a custom role. One transaction per member, and
 * the administrator row marks it as done, so a second run changes nothing.
 *
 * @returns the addresses it created
 */
export async function seedDemoMembers(
  app: INestApplicationContext,
  ctx: RequestContext,
  ownerEmail: string,
  password: string,
): Promise<readonly string[]> {
  const connection = app.get(TransactionalConnection);
  const administrators = connection.rawConnection.getRepository(Administrator);
  const ownerRow = await administrators.findOneBy({ emailAddress: ownerEmail });
  const fields: { businessId?: string | null } | undefined = ownerRow?.customFields;
  if (!ownerRow || !fields?.businessId) throw new Error(`The demo owner ${ownerEmail} has no business`);
  const owner = { administratorId: ownerRow.id as number, businessId: fields.businessId };
  const created: string[] = [];
  for (const member of DEMO_MEMBERS) {
    if (await administrators.existsBy({ emailAddress: member.emailAddress })) continue;
    await connection.withTransaction(ctx, (transactional) =>
      createMember({ app, ctx: transactional, owner, password }, member),
    );
    created.push(member.emailAddress);
  }
  return created;
}
