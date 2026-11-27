import type { CommuneRateRow, WilayaRateRow } from './fee-group';
import { type DeliveryMethod, isQuotablePrice, methodPriceOf } from './method-price';

/** Which delivery methods a store offers in one place, by its fee table's switches. */
export interface DeliveryModes {
  /** Home delivery is offered. */
  readonly home: boolean;
  /** Stop-desk pickup is offered: delivery and the desk switch are both on. */
  readonly desk: boolean;
}

/**
 * The modes a store offers in one wilaya, and in the communes of it whose modes differ (D3125). The shape of geo's
 * `TownAvailability` (D3128), declared here because the domain imports no other plugin.
 */
export interface StoreModes extends DeliveryModes {
  /** The communes whose modes differ from the wilaya's, by ONS code; a commune absent has the wilaya's modes. */
  readonly towns: ReadonlyMap<number, DeliveryModes>;
}

/** Nothing offered anywhere in the wilaya: what the quote answers there too (unresolved). */
export const NOTHING_OFFERED: StoreModes = { home: false, desk: false, towns: new Map() };

/** Whether the method's stored price at the place is one the quote can charge (#294). */
const isPriceable = (wilaya: WilayaRateRow, commune: CommuneRateRow | null, method: DeliveryMethod): boolean =>
  isQuotablePrice(methodPriceOf(wilaya, commune, method).price);

/**
 * The switches of D3125 at one place: *delivery* = commune `deliveryEnabled ?? wilaya deliveryEnabled`, *home* =
 * delivery, *desk* = delivery && (commune `deskEnabled ?? wilaya deskEnabled`), each only when its stored price there
 * is one the quote can charge, so availability never offers a mode the quote answers unresolved (#294). The town's
 * reference stop desk is not read here: the quote and geo's narrowing each AND it in.
 */
export function modesOf(wilaya: WilayaRateRow, commune: CommuneRateRow | null): DeliveryModes {
  const delivers = commune?.deliveryEnabled ?? wilaya.deliveryEnabled;
  const deskOn = commune?.deskEnabled ?? wilaya.deskEnabled;
  return {
    home: delivers && isPriceable(wilaya, commune, 'home'),
    desk: delivers && deskOn && isPriceable(wilaya, commune, 'desk'),
  };
}

const sameModes = (left: DeliveryModes, right: DeliveryModes): boolean =>
  left.home === right.home && left.desk === right.desk;

/**
 * The store's modes in a wilaya from its wilaya row and that wilaya's commune rows. No wilaya row offers nothing,
 * as the quote answers unresolved there whatever a commune row says.
 */
export function storeModesOf(wilaya: WilayaRateRow | null, communes: readonly CommuneRateRow[]): StoreModes {
  if (wilaya === null) return NOTHING_OFFERED;
  const modes = modesOf(wilaya, null);
  const towns = new Map<number, DeliveryModes>();
  for (const commune of communes) {
    const own = modesOf(wilaya, commune);
    if (!sameModes(own, modes)) towns.set(commune.codeOns, own);
  }
  return { ...modes, towns };
}
