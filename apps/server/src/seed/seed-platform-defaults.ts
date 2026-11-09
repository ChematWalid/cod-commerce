import type { INestApplicationContext } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  ConfigService,
  Injector,
  RequestContext,
  RequestContextService,
  TransactionalConnection,
  User,
} from '@vendure/core';
import { ensureAlgeriaZone } from './ensure-algeria-zone';
import { ensureAvailableLanguages } from './ensure-available-languages';
import { ensureDefaultChannel } from './ensure-default-channel';
import { ensureZeroTax } from './ensure-zero-tax';
import type { EnsureStep, SeedReport } from './seed.types';

/** Order matters: the tax rate and the channel reference the zone. */
const SEED_STEPS: readonly EnsureStep[] = [
  ensureAlgeriaZone,
  ensureZeroTax,
  ensureDefaultChannel,
  ensureAvailableLanguages,
];

/** An admin context acting as the superadmin Vendure created at boot, so permission checks pass. */
export async function superadminContext(app: INestApplicationContext): Promise<RequestContext> {
  const { identifier } = app.get(ConfigService).authOptions.superadminCredentials;
  const user = await app
    .get(TransactionalConnection)
    .rawConnection.getRepository(User)
    .findOneOrFail({ where: { identifier }, relations: { roles: { channels: true } } });
  return app.get(RequestContextService).create({ apiType: 'admin', user });
}

/**
 * Brings the platform rows (zone, zero tax, default channel, languages) to their defaults in one
 * transaction. Each step reads first and writes only on a difference, so a second run changes nothing.
 *
 * It converges platform invariants on every `migrate`: currency DZD only, prices including tax, languages
 * exactly ar, fr, en, the zero tax rate and the Algeria zones. A dashboard edit to any of them is reverted
 * by the next deploy. P1.S1 decides whether these become create-if-missing.
 */
export async function seedPlatformDefaults(app: INestApplicationContext): Promise<SeedReport> {
  const injector = new Injector(app.get(ModuleRef));
  const ctx = await superadminContext(app);
  const changes = await app.get(TransactionalConnection).withTransaction(ctx, async (txCtx) => {
    const all: string[] = [];
    for (const step of SEED_STEPS) {
      all.push(...(await step(txCtx, injector)));
    }
    return all;
  });
  return { changes };
}
