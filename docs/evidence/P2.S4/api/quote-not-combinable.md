# Two order discounts that do not combine: the better one applies

On a 5,000 subtotal `ORDER10` is worth 500 and `SAVE1000` 1,000; neither combines with an order discount (D2411, AC5), so `SAVE1000` applies and `ORDER10` is rejected `not_combinable`.

- Call: `PricingService.quoteForScope(ctx, scope, request)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "channel": "storefront",
  "lines": [
    {
      "variantId": "20",
      "quantity": 2
    }
  ],
  "destination": {
    "provinceCode": "16",
    "stopdesk": false
  },
  "codes": [
    "order10",
    "save1000"
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
      "quantity": 2,
      "originalPrice": 2500,
      "unitPrice": 2500,
      "totalPrice": 5000,
      "discounts": []
    }
  ],
  "discounts": [
    {
      "offerId": "<OFFER_SAVE1000>",
      "kind": "order_discount",
      "amount": 1000,
      "code": "SAVE1000"
    }
  ],
  "subtotal": 5000,
  "discountTotal": 1000,
  "delivery": {
    "resolved": true,
    "fee": 800,
    "overweightFee": 0,
    "waived": false,
    "price": 800,
    "freeShipping": false,
    "speed": null
  },
  "total": 4800,
  "savings": 1000,
  "nudge": null,
  "applied": [
    {
      "offerId": "<OFFER_SAVE1000>",
      "kind": "order_discount",
      "amount": 1000,
      "code": "SAVE1000"
    }
  ],
  "skipped": [],
  "rejectedCodes": [
    {
      "code": "ORDER10",
      "reason": "not_combinable"
    }
  ],
  "suggestions": [],
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQzNTA3NDg1OTExNDQ5NiIsImQiOlt7ImFtb3VudCI6MTAwMCwiY29kZSI6IlNBVkUxMDAwIiwib2ZmZXJJZCI6IjI0OTQzNTIzMTk3MzU0ODAzMiJ9XSwiZXhwIjoxNzk1MTYwNDkzLCJoIjoiZDM3N2YzODU0ZTQwNTU5ZGEwN2EyZmEzYTIzMGM3YjdkNmM5MmY1OGQ1MDlmYzVmZDVmMWRjMWNjMzI0NGM0YSIsImtpZCI6ImsxIiwibCI6W3sib2ZmZXJJZHMiOltdLCJvcmlnaW5hbFByaWNlIjoyNTAwLCJxdHkiOjIsInVuaXRQcmljZSI6MjUwMCwidmFyaWFudElkIjoiMjAifV0sIm4iOiJQRG5EdkttWGxPMVNvS09xIiwicCI6MCwicyI6IjI0OTQzNTA3NTA2ODgyOTY5NiIsInNoIjo4MDAsInQiOjQ4MDAsInYiOjF9.[REDACTED]",
  "expiresAt": "2026-11-20T07:41:33.000Z"
}
```
