import {
  type DeliveryFeeGroupInput,
  toBusinessId,
  toSnowflake,
  toStoreId,
  WILAYA_CODES,
  type WilayaCode,
} from '@cod/shared';
import { DefaultTableService } from '../../application/default-table.service';
import { DeliveryDefaultsConvergeService } from '../../application/delivery-defaults-converge.service';
import { DeleteFeeGroupService } from '../../application/delete-fee-group.service';
import { FeeGroupReadService } from '../../application/fee-group-read.service';
import type { FeeGroupPorts } from '../../application/fee-group-ports';
import { SaveFeeGroupService } from '../../application/save-fee-group.service';
import { SetCommuneRatesService } from '../../application/set-commune-rates.service';
import { ShippingQuoteService } from '../../application/shipping-quote.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import {
  FixedStoreDefaults,
  FixedTowns,
  FixedWeights,
  InMemoryFeeGroups,
  inlineTransaction,
} from '../fakes/in-memory-fee-groups';

export const ctx = asOperationContext({});
export const STORE_A1: StoreScope = {
  businessId: toBusinessId('1000000000000000001'),
  storeId: toStoreId(toSnowflake('1000000000000000011')),
};
export const STORE_A2: StoreScope = {
  businessId: STORE_A1.businessId,
  storeId: toStoreId(toSnowflake('1000000000000000012')),
};
export const STORE_B1: StoreScope = {
  businessId: toBusinessId('1000000000000000002'),
  storeId: toStoreId(toSnowflake('1000000000000000021')),
};

/** A fee-group input: one rate per wilaya at `price` home / 400 desk, everything enabled. */
export function groupInput(fields: Partial<DeliveryFeeGroupInput> = {}, price = 600): DeliveryFeeGroupInput {
  return {
    name: 'Standard',
    carrierId: null,
    chargeOverweight: false,
    overweightAllowanceKg: 5,
    overweightRate: 50,
    rates: WILAYA_CODES.map((provinceCode: WilayaCode) => ({
      provinceCode,
      homePrice: price,
      deskPrice: 400,
      deliveryEnabled: true,
      deskEnabled: true,
    })),
    ...fields,
  };
}

/** The use cases over in-memory ports; Alger (16) has communes 1601 and 1652, Adrar (01) has 101. */
export function world() {
  const groups = new InMemoryFeeGroups();
  const storeDefaults = new FixedStoreDefaults();
  const ports: FeeGroupPorts = {
    groups,
    transaction: inlineTransaction,
    storeDefaults,
    towns: new FixedTowns({ '16': [1601, 1652], '01': [101] }),
  };
  return {
    groups,
    storeDefaults,
    reads: new FeeGroupReadService(ports),
    saving: new SaveFeeGroupService(ports),
    deleting: new DeleteFeeGroupService(ports),
    communes: new SetCommuneRatesService(ports),
    defaults: new DefaultTableService(ports),
    converge: new DeliveryDefaultsConvergeService(ports),
  };
}

/** The use cases and the shipping quote; Alger's commune 1652 has no reference stop desk, product weights are fixed. */
export function quoteWorld() {
  const groups = new InMemoryFeeGroups();
  const storeDefaults = new FixedStoreDefaults();
  const weights = new FixedWeights();
  const ports: FeeGroupPorts = {
    groups,
    transaction: inlineTransaction,
    storeDefaults,
    towns: new FixedTowns({ '16': [1601, 1652], '01': [101] }, new Set([1652])),
  };
  return {
    storeDefaults,
    weights,
    saving: new SaveFeeGroupService(ports),
    communes: new SetCommuneRatesService(ports),
    quotes: new ShippingQuoteService(ports, weights),
  };
}
