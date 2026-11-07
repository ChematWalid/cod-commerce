import {
  Country,
  CountryService,
  type Injector,
  type RequestContext,
  TransactionalConnection,
  Zone,
  ZoneService,
} from '@vendure/core';
import { ALGERIA_COUNTRY_CODE, ALGERIA_COUNTRY_NAMES, ALGERIA_ZONE_NAME, seedChange } from './seed.constants';

async function ensureAlgeria(
  ctx: RequestContext,
  injector: Injector,
): Promise<{ country: Country; changes: string[] }> {
  const existing = await injector
    .get(TransactionalConnection)
    .getRepository(ctx, Country)
    .findOne({ where: { code: ALGERIA_COUNTRY_CODE } });
  if (existing) {
    return { country: existing, changes: [] };
  }
  const country = await injector.get(CountryService).create(ctx, {
    code: ALGERIA_COUNTRY_CODE,
    enabled: true,
    translations: [...ALGERIA_COUNTRY_NAMES],
  });
  return { country, changes: [seedChange('country', ALGERIA_COUNTRY_CODE)] };
}

/** Ensures the country DZ exists and the zone "Algeria" holds it. */
export async function ensureAlgeriaZone(ctx: RequestContext, injector: Injector): Promise<string[]> {
  const { country, changes } = await ensureAlgeria(ctx, injector);
  const zone = await injector
    .get(TransactionalConnection)
    .getRepository(ctx, Zone)
    .findOne({ where: { name: ALGERIA_ZONE_NAME }, relations: { members: true } });
  const zoneChange = [seedChange('zone', ALGERIA_ZONE_NAME)];
  if (!zone) {
    await injector.get(ZoneService).create(ctx, { name: ALGERIA_ZONE_NAME, memberIds: [country.id] });
    return [...changes, ...zoneChange];
  }
  if (zone.members.some((member) => member.id === country.id)) {
    return changes;
  }
  await injector.get(ZoneService).addMembersToZone(ctx, { zoneId: zone.id, memberIds: [country.id] });
  return [...changes, ...zoneChange];
}
