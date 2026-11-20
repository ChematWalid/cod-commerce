# A variant of a draft product: unavailable, no token

The cart has a variant of a draft product. The gate refuses it (D2423): the quote is `available: false`, lists it in `unavailableVariantIds` and carries no token (D2425); the priced line still shows.

- Call: `PricingService.quoteForScope(ctx, scope, request)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "channel": "storefront",
  "lines": [
    {
      "variantId": "17",
      "quantity": 1
    },
    {
      "variantId": "21",
      "quantity": 1
    }
  ],
  "destination": {
    "provinceCode": "16",
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
      "key": "17",
      "productId": "11",
      "variantId": "17",
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
    "fee": 800,
    "overweightFee": 0,
    "waived": false,
    "price": 800,
    "freeShipping": false,
    "speed": null
  },
  "total": 5700,
  "savings": 0,
  "nudge": {
    "type": "next_tier",
    "offerId": "<OFFER_QUANTITY>",
    "units": 1,
    "tierQuantity": 2,
    "saving": 980
  },
  "applied": [],
  "skipped": [
    {
      "offerId": "<OFFER_QUANTITY>",
      "reason": "no_tier_reached"
    }
  ],
  "rejectedCodes": [],
  "suggestions": [],
  "available": false,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [
    "21"
  ],
  "quoteToken": null,
  "expiresAt": null
}
```
