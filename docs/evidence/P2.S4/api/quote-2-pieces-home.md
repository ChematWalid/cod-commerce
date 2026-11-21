# Two pieces (red + blue) delivered home: 9,620

One red and one blue variant of the same product count as 2 pieces (D2410): 10 % off each unit, 8,820 + 800.

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
      "variantId": "18",
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
      "unitPrice": 4410,
      "totalPrice": 4410,
      "discounts": [
        {
          "offerId": "<OFFER_QUANTITY>",
          "kind": "quantity",
          "amount": 490
        }
      ]
    },
    {
      "key": "18",
      "productId": "11",
      "variantId": "18",
      "quantity": 1,
      "originalPrice": 4900,
      "unitPrice": 4410,
      "totalPrice": 4410,
      "discounts": [
        {
          "offerId": "<OFFER_QUANTITY>",
          "kind": "quantity",
          "amount": 490
        }
      ]
    }
  ],
  "discounts": [],
  "subtotal": 8820,
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
  "total": 9620,
  "savings": 980,
  "nudge": {
    "type": "next_tier",
    "offerId": "<OFFER_QUANTITY>",
    "units": 1,
    "tierQuantity": 3,
    "saving": 2205
  },
  "applied": [
    {
      "offerId": "<OFFER_QUANTITY>",
      "kind": "quantity",
      "amount": 980
    }
  ],
  "skipped": [],
  "rejectedCodes": [],
  "suggestions": [],
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQ5OTQxNDkxMjA0OTE1MiIsImQiOltdLCJleHAiOjE3OTUxNzU4ODcsImgiOiJjMDM1N2UwNDhiZDZkMzZlMGQ5MDJkM2MyYTFhNjVlZjQ5ZTQ5ZTg2ZWEyY2E2M2E5ZTIyZmNiNDI4NzJkY2RjIiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6WyIyNDk0OTk3OTQ5MDM0MDg2NDAiXSwib3JpZ2luYWxQcmljZSI6NDkwMCwicXR5IjoxLCJ1bml0UHJpY2UiOjQ0MTAsInZhcmlhbnRJZCI6IjE3In0seyJvZmZlcklkcyI6WyIyNDk0OTk3OTQ5MDM0MDg2NDAiXSwib3JpZ2luYWxQcmljZSI6NDkwMCwicXR5IjoxLCJ1bml0UHJpY2UiOjQ0MTAsInZhcmlhbnRJZCI6IjE4In1dLCJuIjoiQ1N2Z3NNcE5mUW1SNlRLciIsIm8iOlt7Im9mZmVySWQiOiIyNDk0OTk3OTQ5MDM0MDg2NDAifV0sInAiOjAsInMiOiIyNDk0OTk0MTk2MDEyODEwMjQiLCJzaCI6ODAwLCJ0Ijo5NjIwLCJ2IjoxfQ.[REDACTED]",
  "expiresAt": "2026-11-20T11:58:07.000Z"
}
```
