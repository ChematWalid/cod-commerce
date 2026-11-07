import {
  type Injector,
  type RequestContext,
  TaxCategory,
  TaxCategoryService,
  TaxRate,
  TaxRateService,
  TransactionalConnection,
  Zone,
} from '@vendure/core';
import {
  ALGERIA_ZONE_NAME,
  seedChange,
  ZERO_TAX_CATEGORY_NAME,
  ZERO_TAX_RATE_NAME,
  ZERO_TAX_RATE_VALUE,
} from './seed.constants';

async function ensureZeroTaxCategory(
  ctx: RequestContext,
  injector: Injector,
): Promise<{ category: TaxCategory; changes: string[] }> {
  const repository = injector.get(TransactionalConnection).getRepository(ctx, TaxCategory);
  const existing = await repository.findOne({ where: { name: ZERO_TAX_CATEGORY_NAME } });
  if (existing?.isDefault === true) {
    return { category: existing, changes: [] };
  }
  const service = injector.get(TaxCategoryService);
  const category = existing
    ? await service.update(ctx, { id: existing.id, isDefault: true })
    : await service.create(ctx, { name: ZERO_TAX_CATEGORY_NAME, isDefault: true });
  return { category, changes: [seedChange('tax-category', ZERO_TAX_CATEGORY_NAME)] };
}

const rateMatches = (rate: TaxRate, category: TaxCategory, zone: Zone): boolean =>
  rate.enabled && rate.value === ZERO_TAX_RATE_VALUE && rate.categoryId === category.id && rate.zoneId === zone.id;

/** Ensures the default tax category "Zero rate" and its 0 % rate in the zone "Algeria" (run after the zone). */
export async function ensureZeroTax(ctx: RequestContext, injector: Injector): Promise<string[]> {
  const { category, changes } = await ensureZeroTaxCategory(ctx, injector);
  const connection = injector.get(TransactionalConnection);
  const zone = await connection.getRepository(ctx, Zone).findOneOrFail({ where: { name: ALGERIA_ZONE_NAME } });
  const rate = await connection.getRepository(ctx, TaxRate).findOne({ where: { name: ZERO_TAX_RATE_NAME } });
  if (rate && rateMatches(rate, category, zone)) {
    return changes;
  }
  const input = { enabled: true, value: ZERO_TAX_RATE_VALUE, categoryId: category.id, zoneId: zone.id };
  const service = injector.get(TaxRateService);
  await (rate
    ? service.update(ctx, { id: rate.id, ...input })
    : service.create(ctx, { name: ZERO_TAX_RATE_NAME, ...input }));
  return [...changes, seedChange('tax-rate', ZERO_TAX_RATE_NAME)];
}
