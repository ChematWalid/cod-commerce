/**
 * The buyer's words of the Arabic order-form preview (D2539). The preview shows the order form as an Arabic buyer
 * sees it, whatever the merchant's dashboard language, so its copy is fixed Arabic rather than a dashboard message;
 * written fresh, never taken from the research captures (ADR 0007). The storefront owns the real order form (P3).
 */
export const PREVIEW_COPY = {
  quantity: 'الكمية',
  unitPrice: 'سعر القطعة',
  lineTotal: 'المبلغ',
  gift: 'هدية',
  addon: 'منتج إضافي',
  delivery: 'التوصيل',
  freeDelivery: 'توصيل مجاني',
  saving: 'وفّرت',
  total: 'المجموع',
  currency: 'دج',
  nextTier: 'أضف {units} للحصول على سعر أفضل',
} as const;

/** `PREVIEW_COPY.nextTier` with its count. */
export const nextTierText = (units: string): string => PREVIEW_COPY.nextTier.replace('{units}', units);
