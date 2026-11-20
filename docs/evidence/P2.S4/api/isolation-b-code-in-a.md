# Business B's code in store A1: not found

`BONLY20` is a published code of business B. Store A1's quote rejects it as `not_found` (the code lookup is scoped to A1's business and store, D2406) and no offer of B appears anywhere in the quote.

- Call: `PricingService.quoteForScope(ctx, scope, request)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "channel": "storefront",
  "lines": [
    {
      "variantId": "20",
      "quantity": 1
    }
  ],
  "destination": {
    "provinceCode": "16",
    "stopdesk": false
  },
  "codes": [
    "bonly20"
  ]
}
```

## Output

```json
{
  "currency": "DZD",
  "lines": [
    {
      "key": "20",
      "productId": "13",
      "variantId": "20",
      "quantity": 1,
      "originalPrice": 2500,
      "unitPrice": 2500,
      "totalPrice": 2500,
      "discounts": []
    }
  ],
  "discounts": [],
  "subtotal": 2500,
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
  "total": 3300,
  "savings": 0,
  "nudge": null,
  "applied": [],
  "skipped": [],
  "rejectedCodes": [
    {
      "code": "BONLY20",
      "reason": "not_found"
    }
  ],
  "suggestions": [],
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQ5OTQxNDkxMjA0OTE1MiIsImQiOltdLCJleHAiOjE3OTUxNzU4ODcsImgiOiIyMzMwNGNkY2ExN2ZjZjE0NzQyNjM5ZmM4ZTdjNzY3NzcyMTg4YmZhOTUxYzM1MGMwZTY2N2QzN2JkOGZlZmYwIiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6W10sIm9yaWdpbmFsUHJpY2UiOjI1MDAsInF0eSI6MSwidW5pdFByaWNlIjoyNTAwLCJ2YXJpYW50SWQiOiIyMCJ9XSwibiI6IkNBclVOLUdydlc0am1neHQiLCJvIjpbXSwicCI6MCwicyI6IjI0OTQ5OTQxOTYwMTI4MTAyNCIsInNoIjo4MDAsInQiOjMzMDAsInYiOjF9.[REDACTED]",
  "expiresAt": "2026-11-20T11:58:07.000Z"
}
```
