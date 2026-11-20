# One piece to a stop desk: 5,400

The same piece delivered to a stop desk (fee 500): 4,900 + 500.

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
    }
  ],
  "destination": {
    "provinceCode": "16",
    "stopdesk": true
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
    "fee": 500,
    "overweightFee": 0,
    "waived": false,
    "price": 500,
    "freeShipping": false,
    "speed": null
  },
  "total": 5400,
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
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQzNTA3NDg1OTExNDQ5NiIsImQiOltdLCJleHAiOjE3OTUxNjA0OTMsImgiOiI0Njc2ZmQ4MjBiOTE1ZTgxMmMxYTIwOWVjMTM5MDk1MGQ1MWY4N2EyMGQ1NzVkZTkwYTM1MmI3MzE4NTdhOGU0Iiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6W10sIm9yaWdpbmFsUHJpY2UiOjQ5MDAsInF0eSI6MSwidW5pdFByaWNlIjo0OTAwLCJ2YXJpYW50SWQiOiIxNyJ9XSwibiI6IndUWFNmR0ZIbWpnbDZxVk4iLCJwIjowLCJzIjoiMjQ5NDM1MDc1MDY4ODI5Njk2Iiwic2giOjUwMCwidCI6NTQwMCwidiI6MX0.[REDACTED]",
  "expiresAt": "2026-11-20T07:41:33.000Z"
}
```
