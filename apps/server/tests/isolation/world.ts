import { createHmac } from 'node:crypto';
import { type Caller, fieldOf, type IsolationHttp } from './http';
import {
  ACTIVE_ADMINISTRATOR,
  CREATE_NOTE,
  CREATE_ROLE,
  CREATE_STORE,
  DEMO_SECRET,
  MEMBER_STOCK_PERMISSIONS,
  OFFER_PLATFORM_LANGUAGES,
  ONE_PIXEL_PNG,
  OVERRIDDEN_FLAG,
  PROVISION_BUSINESS,
  SET_FLAG_OVERRIDE,
  SET_MEMBER_ACCESS,
  SET_SECRET,
  STOCK_ACTIVE_CHANNEL,
  STOCK_CREATE_ADMINISTRATOR,
  STOCK_CREATE_ROLE,
  UPDATE_PROFILE,
  UPLOAD_LOGO,
} from './seed-operations';

/** A store of the world: its label (`A1`) names it in transcripts. */
export interface WorldStore {
  readonly label: string;
  readonly id: string;
  readonly subdomain: string;
  readonly channelToken: string;
}

/** One business with a row in every P1 tenant table. */
export interface BusinessWorld {
  readonly label: 'A' | 'B';
  readonly businessId: string;
  readonly name: string;
  readonly stores: readonly [WorldStore, WorldStore];
  readonly owner: Caller & { readonly email: string; readonly administratorId: string; readonly lastName: string };
  /** A member with a business role on the first store only. */
  readonly member: Caller & { readonly email: string; readonly administratorId: string };
  readonly role: { readonly id: string; readonly name: string };
  readonly secret: { readonly id: string; readonly value: string };
  readonly note: { readonly id: string; readonly title: string };
  readonly logoAssetId: string;
}

/** The two businesses and the platform superadmin who provisioned them. */
export interface World {
  readonly a: BusinessWorld;
  readonly b: BusinessWorld;
  readonly superadmin: Caller;
}

/** What only the host can do: link an administrator to a business (an `internal` custom field, D2). */
export interface WorldHooks {
  linkToBusiness(administratorId: string, businessId: string): Promise<void>;
}

/** How the world is built: where, as whom, and with which unique suffix. */
export interface WorldOptions {
  readonly http: IsolationHttp;
  readonly hooks: WorldHooks;
  readonly superadmin: { readonly username: string; readonly password: string };
  /** Makes every name and address unique to this run, so the leak scan finds only this run's values. */
  readonly suffix: string;
  readonly password: string;
}

const channelOf = (store: WorldStore): { label: string; token: string } => ({
  label: store.label,
  token: store.channelToken,
});

/** Signs a demo webhook body as the demo handler checks it. */
export const demoSignature = (secret: string, body: string): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

/** Provisions business `label` with two stores and signs its owner in. */
async function provision(options: WorldOptions, superadmin: Caller, label: 'A' | 'B') {
  const { http, suffix, password } = options;
  const tag = `${label.toLowerCase()}-${suffix}`;
  const email = `owner-${tag}@example.test`;
  const input = {
    name: `Business ${label} ${suffix}`,
    owner: { emailAddress: email, firstName: `Owner${label}`, lastName: 'Seed', password },
    store: { name: `Store ${label}1 ${suffix}`, subdomain: `${tag}-1`, language: 'ar' },
  };
  const provisioned = fieldOf(await http.graphql(superadmin, PROVISION_BUSINESS, { input }), 'provisionBusiness') as {
    business: { id: string; name: string };
    store: Omit<WorldStore, 'label'>;
  };
  const first: WorldStore = { label: `${label}1`, ...provisioned.store };
  const session = await http.login(`owner ${label}`, email, password);
  const secondInput = { name: `Store ${label}2 ${suffix}`, subdomain: `${tag}-2`, language: 'fr' };
  const second = fieldOf(
    await http.graphql(session, CREATE_STORE, { input: secondInput }, channelOf(first)),
    'createStore',
  ) as Omit<WorldStore, 'label'>;
  return {
    business: provisioned.business,
    email,
    session,
    stores: [first, { label: `${label}2`, ...second }] as const,
  };
}

/** Creates a member through the stock API and links it to the business, as `createMember` does. */
async function createMember(options: WorldOptions, superadmin: Caller, store: WorldStore, businessId: string) {
  const { http, suffix, password } = options;
  const code = `member-${store.label.toLowerCase()}-${suffix}`;
  const email = `${code}@example.test`;
  const as = async <T>(query: string, variables: Record<string, unknown>, field: string): Promise<T> =>
    fieldOf(await http.graphql(superadmin, query, variables), field) as T;
  const channel = fieldOf(
    await http.graphql(superadmin, STOCK_ACTIVE_CHANNEL, {}, channelOf(store)),
    'activeChannel',
  ) as { id: string };
  const roleInput = { code, description: code, permissions: MEMBER_STOCK_PERMISSIONS, channelIds: [channel.id] };
  const role = await as<{ id: string }>(STOCK_CREATE_ROLE, { input: roleInput }, 'createRole');
  const adminInput = { emailAddress: email, firstName: 'Member', lastName: store.label, password, roleIds: [role.id] };
  const administrator = await as<{ id: string }>(
    STOCK_CREATE_ADMINISTRATOR,
    { input: adminInput },
    'createAdministrator',
  );
  await options.hooks.linkToBusiness(administrator.id, businessId);
  return { email, administratorId: administrator.id };
}

/** Builds one business: its stores, owner, member, role, secret, note, logo and flag override. */
async function buildBusiness(options: WorldOptions, superadmin: Caller, label: 'A' | 'B'): Promise<BusinessWorld> {
  const { http, suffix } = options;
  const base = await provision(options, superadmin, label);
  const own = channelOf(base.stores[0]);
  const as = async <T>(query: string, variables: Record<string, unknown>, field: string): Promise<T> =>
    fieldOf(await http.graphql(base.session, query, variables, own), field) as T;
  const ownerId = (await as<{ id: string }>(ACTIVE_ADMINISTRATOR, {}, 'activeAdministrator')).id;
  const lastName = `Private${label}${suffix}`;
  await as(UPDATE_PROFILE, { input: { lastName } }, 'updateAccountProfile');
  const member = await createMember(options, superadmin, base.stores[0], base.business.id);
  const roleInput = { name: `Role ${label} ${suffix}`, areaLevels: [{ area: 'orders', level: 'view' }] };
  const role = await as<{ id: string; name: string }>(CREATE_ROLE, { input: roleInput }, 'createBusinessRole');
  const access = { administratorId: member.administratorId, roleIds: [role.id], storeAccess: 'selected' };
  await as(SET_MEMBER_ACCESS, { input: { ...access, storeIds: [base.stores[0].id] } }, 'setMemberAccess');
  const value = `demo-signing-${label.toLowerCase()}-${suffix}`;
  const secret = await as<{ id: string }>(SET_SECRET, { input: { ...DEMO_SECRET, value } }, 'setTenantSecret');
  const noteInput = { title: `Note ${label} ${suffix}`, body: 'private' };
  const note = await as<{ id: string; title: string }>(CREATE_NOTE, { input: noteInput }, 'createTemplateNote');
  const logo = fieldOf(await http.upload(base.session, UPLOAD_LOGO, ONE_PIXEL_PNG, own), 'uploadBusinessLogo') as {
    assetId: string;
  };
  const scope = { key: OVERRIDDEN_FLAG, scope: 'BUSINESS', scopeId: base.business.id, enabled: true };
  fieldOf(await http.graphql(superadmin, SET_FLAG_OVERRIDE, { input: scope }), 'setFeatureFlagOverride');
  const memberSession = await http.login(`member ${label}`, member.email, options.password);
  return {
    label,
    businessId: base.business.id,
    name: base.business.name,
    stores: base.stores,
    owner: { ...base.session, email: base.email, administratorId: ownerId, lastName },
    member: { ...memberSession, ...member },
    role,
    secret: { id: secret.id, value },
    note,
    logoAssetId: logo.assetId,
  };
}

/** Posts one signed demo webhook to each store of the business, so its inbound and outbox tables hold rows. */
export async function postWebhooks(http: IsolationHttp, business: BusinessWorld): Promise<void> {
  for (const store of business.stores) {
    const body = JSON.stringify({ event: 'isolation.seed', store: store.label });
    const exchange = await http.send({
      method: 'POST',
      path: `/webhooks/demo/${store.subdomain}`,
      caller: { label: 'demo provider' },
      rawBody: body,
      headers: { 'x-demo-signature': demoSignature(business.secret.value, body), 'x-demo-event-id': store.id },
    });
    if (exchange.status !== 200) throw new Error(`webhook for ${store.label}: HTTP ${String(exchange.status)}`);
  }
}

/** Seeds businesses A and B, each with a row in every P1 tenant table. */
export async function buildWorld(options: WorldOptions): Promise<World> {
  const superadmin = await options.http.login('superadmin', options.superadmin.username, options.superadmin.password);
  fieldOf(await options.http.graphql(superadmin, OFFER_PLATFORM_LANGUAGES), 'updateGlobalSettings');
  const a = await buildBusiness(options, superadmin, 'A');
  const b = await buildBusiness(options, superadmin, 'B');
  await postWebhooks(options.http, a);
  await postWebhooks(options.http, b);
  return { a, b, superadmin };
}
