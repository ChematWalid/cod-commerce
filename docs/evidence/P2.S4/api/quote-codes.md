# Discount codes: valid, duplicate, not found, used up

` welcome10 ` is normalised to `WELCOME10` and applies (D2406); the same code again is `duplicate`; `NOPE99` is `not_found`; `usedup15` has reached its usage limit of 1 (the script recorded one order use of it through `OfferUsageService.recordOrderUses`, the use case P3.S4 calls, D2447) and is `code_limit` (AC4). The token payload `o` names the applied offer with its code (D2445).

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
    " welcome10 ",
    "WELCOME10",
    "NOPE99",
    "usedup15"
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
      "unitPrice": 2250,
      "totalPrice": 2250,
      "discounts": [
        {
          "offerId": "<OFFER_WELCOME10>",
          "kind": "product_discount",
          "amount": 250
        }
      ]
    }
  ],
  "discounts": [],
  "subtotal": 2250,
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
  "total": 3050,
  "savings": 250,
  "nudge": null,
  "applied": [
    {
      "offerId": "<OFFER_WELCOME10>",
      "kind": "product_discount",
      "amount": 250,
      "code": "WELCOME10"
    }
  ],
  "skipped": [],
  "rejectedCodes": [
    {
      "code": "WELCOME10",
      "reason": "duplicate"
    },
    {
      "code": "NOPE99",
      "reason": "not_found"
    },
    {
      "code": "USEDUP15",
      "reason": "code_limit"
    }
  ],
  "suggestions": [],
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQ5OTQxNDkxMjA0OTE1MiIsImQiOltdLCJleHAiOjE3OTUxNzU4ODcsImgiOiI5ZjgwNjIyMmRjNzU2NDk3MGFjZTU1NDY0ODRlYjk2NzRhZTc3YzRkN2RmNTMwZDk1NzQ2OTg4Njg1NDMxYzU5Iiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6WyIyNDk0OTk3OTYxMjgxNDU0MDgiXSwib3JpZ2luYWxQcmljZSI6MjUwMCwicXR5IjoxLCJ1bml0UHJpY2UiOjIyNTAsInZhcmlhbnRJZCI6IjIwIn1dLCJuIjoiWm5YN1Y0QnVBX1MzelZ0MSIsIm8iOlt7ImNvZGUiOiJXRUxDT01FMTAiLCJvZmZlcklkIjoiMjQ5NDk5Nzk2MTI4MTQ1NDA4In1dLCJwIjowLCJzIjoiMjQ5NDk5NDE5NjAxMjgxMDI0Iiwic2giOjgwMCwidCI6MzA1MCwidiI6MX0.[REDACTED]",
  "expiresAt": "2026-11-20T11:58:07.000Z"
}
```
