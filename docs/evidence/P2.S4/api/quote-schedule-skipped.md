# Offers outside their schedule: skipped not_started and ended

Two published automatic offers on this product: one starts next week, one ended an hour ago (D2419, AC3). Both are reported in `skipped` and the price is untouched.

- Call: `PricingService.quoteForScope(ctx, scope, request)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "channel": "storefront",
  "lines": [
    {
      "variantId": "19",
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
      "key": "19",
      "productId": "12",
      "variantId": "19",
      "quantity": 1,
      "originalPrice": 3000,
      "unitPrice": 3000,
      "totalPrice": 3000,
      "discounts": []
    }
  ],
  "discounts": [],
  "subtotal": 3000,
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
  "total": 3800,
  "savings": 0,
  "nudge": null,
  "applied": [],
  "skipped": [
    {
      "offerId": "<OFFER_ENDED>",
      "reason": "ended"
    },
    {
      "offerId": "<OFFER_NOT_STARTED>",
      "reason": "not_started"
    }
  ],
  "rejectedCodes": [],
  "suggestions": [],
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQ5OTQxNDkxMjA0OTE1MiIsImQiOltdLCJleHAiOjE3OTUxNzU4ODcsImgiOiJiNTc0ZWY2MTZjNGQzY2M3M2JhZmY5MDRmZmQwYmRjYzVmOWE1NTQ5MDQ1OTYyMWZmYWIwZGNkNjE3ODk4MDAyIiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6W10sIm9yaWdpbmFsUHJpY2UiOjMwMDAsInF0eSI6MSwidW5pdFByaWNlIjozMDAwLCJ2YXJpYW50SWQiOiIxOSJ9XSwibiI6Ik5mOXRkbjZHMk43UmoyeksiLCJvIjpbXSwicCI6MCwicyI6IjI0OTQ5OTQxOTYwMTI4MTAyNCIsInNoIjo4MDAsInQiOjM4MDAsInYiOjF9.[REDACTED]",
  "expiresAt": "2026-11-20T11:58:07.000Z"
}
```
