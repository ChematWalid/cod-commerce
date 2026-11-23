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
      "variantId": "17",
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
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI1MDQ1MzY2MjI2MDc5NzQ0MCIsImQiOltdLCJleHAiOjE3OTU0MDMzNDIsImgiOiIwMGY2YzY5MmUzMmQ0MjIwNDAyMDU3Y2E0NTc0MGJkYTM1NWIzNzM0Y2ZmNjdiZGMzMTI3NzY2OWZlZjkwMDZkIiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6W10sIm9yaWdpbmFsUHJpY2UiOjQ5MDAsInF0eSI6MSwidW5pdFByaWNlIjo0OTAwLCJ2YXJpYW50SWQiOiIxNyJ9XSwibiI6IkJHWlZmcHl2enFoZ3ZDeWgiLCJvIjpbXSwicCI6MCwicyI6IjI1MDQ1MzY2MjUwNDA2NzA3MiIsInNoIjo3NzcsInQiOjU2NzcsInYiOjF9.[REDACTED]",
  "expiresAt": "2026-11-23T03:09:02.000Z"
}
```
