# Order quote with delivery: 4900 + 777 DZD

The offers' scoped pricing core (D2408) asks its shipping seam for the fee; delivery pricing answers with the store's table (D2423), so the order total carries the commune price.

- Call: `PricingService.quoteForScope(ctx, scope, request)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "channel": "storefront",
  "lines": [
    {
      "variantId": "35",
      "quantity": 1
    }
  ],
  "destination": {
    "provinceCode": "16",
    "townOns": "1601",
    "stopdesk": false
  }
}
```

## Output

```json
{
  "currency": "DZD",
  "lines": [
    {
      "key": "35",
      "productId": "21",
      "variantId": "35",
      "quantity": 1,
      "originalPrice": 4900,
      "unitPrice": 4900,
      "totalPrice": 4900,
      "discounts": []
    }
  ],
  "discounts": [],
  "subtotal": 4900,
  "discountTotal": 0,
  "delivery": {
    "resolved": true,
    "fee": 777,
    "overweightFee": 0,
    "waived": false,
    "price": 777,
    "freeShipping": false,
    "speed": "standard"
  },
  "total": 5677,
  "savings": 0,
  "nudge": null,
  "applied": [],
  "skipped": [],
  "rejectedCodes": [],
  "rejectedAddons": [],
  "suggestions": [],
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.[PAYLOAD REDACTED].[REDACTED]",
  "expiresAt": "2026-11-27T12:39:37.000Z"
}
```
