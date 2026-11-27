import { isWilayaCode, type ShippingQuote } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductWeights, ProductWeightsPort } from '../domain/ports/product-weights.port';
import type { TownReference } from '../domain/ports/town-directory.port';
import { type OverweightSettings, quoteDelivery, UNRESOLVED_QUOTE } from '../domain/quote';
import {
  isReadableParcel,
  parcelWeightOf,
  productsWithoutWeight,
  type ShippingQuoteItem,
  type ShippingQuoteRequest,
} from '../domain/quote-request';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/** The town a request names: none (`null`), its reference, or `undefined` when it names no commune of the wilaya. */
type NamedTown = TownReference | null | undefined;

/**
 * The store's delivery quote (D3125): the store's default fee group, read only within `(businessId, storeId)`, priced
 * for the wilaya and commune by the pure {@link quoteDelivery}. No default group, a group of another store, an
 * unknown or other-wilaya commune, an unreadable line or the store's products unreadable in `ctx` all answer
 * unresolved. Offers (Task 7), the storefront checkout (P3.S3) and the order form (P4.S3) call it; the scope comes
 * from the session or the signed host, never from a request body.
 */
export class ShippingQuoteService {
  constructor(
    private readonly ports: FeeGroupPorts,
    private readonly weights: ProductWeightsPort,
  ) {}

  /** The delivery quote of `request` in the store `scope`, in whole DZD. */
  async quote(ctx: OperationContext, scope: StoreScope, request: ShippingQuoteRequest): Promise<ShippingQuote> {
    if (!isWilayaCode(request.provinceCode) || !isReadableParcel(request.items)) return UNRESOLVED_QUOTE;
    const groupId = await this.ports.storeDefaults.defaultGroupOf(ctx, scope);
    if (groupId === null) return UNRESOLVED_QUOTE;
    const town = await this.townOf(request);
    if (town === undefined) return UNRESOLVED_QUOTE;
    const { provinceCode } = request;
    const rows = await this.ports.groups.quoteRows(ctx, scope, {
      groupId,
      provinceCode,
      codeOns: request.townOns ?? null,
    });
    if (rows === undefined) return UNRESOLVED_QUOTE;
    const weightGrams = await this.weightOf(ctx, scope, rows.group, request.items);
    if (weightGrams === 'unreadable') return UNRESOLVED_QUOTE;
    return quoteDelivery({
      group: rows.group,
      rate: rows.rate,
      communeRate: rows.communeRate,
      town,
      weightGrams,
      method: request.stopdesk ? 'desk' : 'home',
      waive: request.waive ?? false,
    });
  }

  private async townOf({ provinceCode, townOns }: ShippingQuoteRequest): Promise<NamedTown> {
    if (townOns === undefined) return null;
    return this.ports.towns.townOf(provinceCode, townOns);
  }

  /**
   * The parcel weight, 0 for a group that does not charge overweight. Only the products of lines without a sent weight
   * are read, in one batch; `'unreadable'` passes through (#293).
   */
  private async weightOf(
    ctx: OperationContext,
    scope: StoreScope,
    group: OverweightSettings,
    items: readonly ShippingQuoteItem[],
  ): Promise<number | 'unreadable'> {
    if (!group.chargeOverweight) return 0;
    const missing = productsWithoutWeight(items);
    const weights: ProductWeights =
      missing.length === 0 ? new Map<string, number | null>() : await this.weights.weightsOf(ctx, scope, missing);
    if (weights === 'unreadable') return weights;
    return parcelWeightOf(items, weights);
  }
}
