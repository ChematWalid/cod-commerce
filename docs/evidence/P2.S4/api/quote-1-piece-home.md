# One piece at 4,900 delivered home: 5,700 and a nudge of 980

The research worked example (AC1, AC2): one piece at 4,900 DZD plus home delivery 800. The 2-piece tier is one unit away and would save 980 DZD (10 % of 4,900 on both pieces, D2416).

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
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQ5OTQxNDkxMjA0OTE1MiIsImQiOltdLCJleHAiOjE3OTUxNzU4ODcsImgiOiJmNTIzYmM3M2RmZmFlN2JmNTQwNTRkZDMyMWNhZjExZTY0OTcxOWJiY2EzMmQ3ZDM1ZmY2YWEzMjY3NTdkMTE1Iiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6W10sIm9yaWdpbmFsUHJpY2UiOjQ5MDAsInF0eSI6MSwidW5pdFByaWNlIjo0OTAwLCJ2YXJpYW50SWQiOiIxNyJ9XSwibiI6IkdWWENKeDd0VzluN0ZwNVYiLCJvIjpbXSwicCI6MCwicyI6IjI0OTQ5OTQxOTYwMTI4MTAyNCIsInNoIjo4MDAsInQiOjU3MDAsInYiOjF9.[REDACTED]",
  "expiresAt": "2026-11-20T11:58:07.000Z"
}
```
