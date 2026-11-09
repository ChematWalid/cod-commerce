import {
  asOperationContext,
  CreateStoreService,
  type OperationContext,
  ProvisionBusinessService,
  SubdomainTakenError,
} from '@cod/plugin-tenancy';
import { type Snowflake, toSnowflake } from '@cod/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { Administrator, type RequestContext, TransactionalConnection } from '@vendure/core';
import type { AppEnv } from '../config/env';
import { seedDemoMembers } from './seed-demo-members';
import { superadminContext } from './seed-platform-defaults';

/** The demo seed was asked to run where it must not. */
export class DemoSeedRefusedError extends Error {
  constructor(reason: string) {
    super(`Refusing the demo seed: ${reason}`);
    this.name = 'DemoSeedRefusedError';
  }
}

interface DemoStore {
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
}

interface DemoBusiness {
  readonly name: string;
  readonly ownerEmail: string;
  readonly firstStore: DemoStore;
  readonly secondStore: DemoStore;
}

const DEMO_OWNER_EMAIL = 'owner@demo.example.test';

const DEMO_BUSINESSES: readonly DemoBusiness[] = [
  {
    name: 'Demo',
    ownerEmail: DEMO_OWNER_EMAIL,
    firstStore: { name: 'Demo Store', subdomain: 'demo', language: 'ar' },
    secondStore: { name: 'Demo Store 2', subdomain: 'demo2', language: 'en' },
  },
  {
    name: 'Second',
    ownerEmail: 'owner@second.example.test',
    firstStore: { name: 'Second Store', subdomain: 'second', language: 'fr' },
    secondStore: { name: 'Second Store 2', subdomain: 'second2', language: 'en' },
  },
];

/** What a run created, by subdomain. Empty on a second run. */
export interface DemoSeedReport {
  readonly created: readonly string[];
}

/** The password, once the environment is known to allow the seed. */
function assertSeedable(env: AppEnv): string {
  if (env.APP_ENV === 'production') throw new DemoSeedRefusedError('APP_ENV is production');
  if (env.DEMO_OWNER_PASSWORD === undefined) throw new DemoSeedRefusedError('DEMO_OWNER_PASSWORD is not set');
  return env.DEMO_OWNER_PASSWORD;
}

/** The business of an owner the seed made earlier: the administrator row is what marks it as done. */
async function existingBusinessId(app: INestApplicationContext, emailAddress: string): Promise<string | undefined> {
  const administrators = app.get(TransactionalConnection).rawConnection.getRepository(Administrator);
  const owner = await administrators.findOneBy({ emailAddress });
  // The plugin declares this custom field at runtime, so Vendure's type does not list it.
  const fields: { businessId?: string | null } | undefined = owner?.customFields;
  return fields?.businessId ?? undefined;
}

/** Opens the store unless a previous run already did. */
async function ensureStore(
  app: INestApplicationContext,
  ctx: OperationContext,
  businessId: Snowflake,
  store: DemoStore,
): Promise<readonly string[]> {
  try {
    await app.get(CreateStoreService).create(ctx, businessId, store);
    return [store.subdomain];
  } catch (error) {
    if (error instanceof SubdomainTakenError) return [];
    throw error;
  }
}

async function ensureBusiness(
  app: INestApplicationContext,
  ctx: RequestContext,
  demo: DemoBusiness,
  password: string,
): Promise<readonly string[]> {
  const operation = asOperationContext(ctx);
  const existing = await existingBusinessId(app, demo.ownerEmail);
  if (existing !== undefined) return ensureStore(app, operation, toSnowflake(existing), demo.secondStore);
  const { business } = await app.get(ProvisionBusinessService).provision(operation, {
    name: demo.name,
    owner: { emailAddress: demo.ownerEmail, firstName: demo.name, lastName: 'Owner', password },
    store: demo.firstStore,
  });
  const second = await ensureStore(app, operation, business.id, demo.secondStore);
  return [demo.firstStore.subdomain, ...second];
}

/**
 * Creates the two synthetic businesses local stacks and browser tests run on. Safe to run again: what exists
 * is left alone, and a run interrupted between stores finishes the job.
 *
 * @throws {@link DemoSeedRefusedError} when `APP_ENV` is production or `DEMO_OWNER_PASSWORD` is missing.
 */
export async function seedDemoBusinesses(app: INestApplicationContext, env: AppEnv): Promise<DemoSeedReport> {
  const password = assertSeedable(env);
  const ctx = await superadminContext(app);
  const created: string[] = [];
  for (const demo of DEMO_BUSINESSES) {
    created.push(...(await ensureBusiness(app, ctx, demo, password)));
  }
  created.push(...(await seedDemoMembers(app, ctx, DEMO_OWNER_EMAIL, password)));
  return { created };
}
