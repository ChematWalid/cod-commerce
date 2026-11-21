import type { KindEditorId } from '../../model/kind-editors';
import { BuyTargetsEditor, type EditorComponent } from '../kind-editor-slot';
import { AddonEditor } from './addon-editor';
import { BxgyEditor } from './bxgy-editor';
import { DiscountCodesEditor } from './discount-codes-editor';
import { FreeDeliveryEditor } from './free-delivery-editor';
import { OrderDiscountEditor } from './order-discount-editor';
import { ProductDiscountEditor } from './product-discount-editor';
import { QuantityEditor } from './quantity-editor';

/**
 * The kinds' own editors by app-type id (D2523): a map, never a branch per kind (§3a.7). Its type asks for one editor
 * per id of `KIND_EDITOR_IDS`; an app's own card (P9.S8b) adds its id there and its editor here.
 */
export const KIND_EDITORS: Readonly<Record<KindEditorId, EditorComponent>> = {
  quantity: QuantityEditor,
  free_delivery: FreeDeliveryEditor,
  product_discount: ProductDiscountEditor,
  discount_codes: DiscountCodesEditor,
  bxgy: BxgyEditor,
  order_discount: OrderDiscountEditor,
  addon: AddonEditor,
};

const isKindEditorId = (appTypeId: string): appTypeId is KindEditorId => Object.hasOwn(KIND_EDITORS, appTypeId);

/** The editor of `appTypeId`'s card; a card the dashboard does not know gets the buy-target picker. */
export const kindEditorOf = (appTypeId: string): EditorComponent =>
  isKindEditorId(appTypeId) ? KIND_EDITORS[appTypeId] : BuyTargetsEditor;
