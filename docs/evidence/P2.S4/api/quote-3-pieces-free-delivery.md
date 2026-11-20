# Three pieces: 15 % off and free delivery, 12,495

The 3-piece tier (15 % off, the fixture assumption of the elided research figure) waives delivery (D2414): 4,900 − 735 = 4,165 per unit (half-up per unit, D2409), × 3 = 12,495, delivery price 0, waived.

- Call: `PricingService.quoteForScope(ctx, scope, request)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "channel": "storefront",
  "lines": [
    {
      "variantId": "17",
      "quantity": 2
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
      "quantity": 2,
      "originalPrice": 4900,
      "unitPrice": 4165,
      "totalPrice": 8330,
      "discounts": [
        {
          "offerId": "<OFFER_QUANTITY>",
          "kind": "quantity",
          "amount": 1470
        }
      ]
    },
    {
      "key": "18",
      "productId": "11",
      "variantId": "18",
      "quantity": 1,
      "originalPrice": 4900,
      "unitPrice": 4165,
      "totalPrice": 4165,
      "discounts": [
        {
          "offerId": "<OFFER_QUANTITY>",
          "kind": "quantity",
          "amount": 735
        }
      ]
    }
  ],
  "discounts": [],
  "subtotal": 12495,
  "discountTotal": 0,
  "delivery": {
    "resolved": true,
    "fee": 800,
    "overweightFee": 0,
    "waived": true,
    "price": 0,
    "freeShipping": true,
    "speed": null
  },
  "total": 12495,
  "savings": 3005,
  "nudge": null,
  "applied": [
    {
      "offerId": "<OFFER_QUANTITY>",
      "kind": "quantity",
      "amount": 3005
    }
  ],
  "skipped": [],
  "rejectedCodes": [],
  "suggestions": [],
  "available": true,
  "orderPricingMode": "quote",
  "unavailableVariantIds": [],
  "quoteToken": "qt1.eyJhIjpbXSwiYiI6IjI0OTQ5OTQxNDkxMjA0OTE1MiIsImQiOltdLCJleHAiOjE3OTUxNzU4ODcsImgiOiI3MDViNzQzOTBmYjBlODNhOTcxMjZkMjczNmViN2U2ZjY0YzdlNWQzMTQ5ODM0N2ZkNmM4ODZhZmU2NGIyZTQ0Iiwia2lkIjoiazEiLCJsIjpbeyJvZmZlcklkcyI6WyIyNDk0OTk3OTQ5MDM0MDg2NDAiXSwib3JpZ2luYWxQcmljZSI6NDkwMCwicXR5IjoyLCJ1bml0UHJpY2UiOjQxNjUsInZhcmlhbnRJZCI6IjE3In0seyJvZmZlcklkcyI6WyIyNDk0OTk3OTQ5MDM0MDg2NDAiXSwib3JpZ2luYWxQcmljZSI6NDkwMCwicXR5IjoxLCJ1bml0UHJpY2UiOjQxNjUsInZhcmlhbnRJZCI6IjE4In1dLCJuIjoidUxYbDg0ajZTYUU2V1BIUCIsIm8iOlt7Im9mZmVySWQiOiIyNDk0OTk3OTQ5MDM0MDg2NDAifV0sInAiOjAsInMiOiIyNDk0OTk0MTk2MDEyODEwMjQiLCJzaCI6MCwidCI6MTI0OTUsInYiOjF9.[REDACTED]",
  "expiresAt": "2026-11-20T11:58:07.000Z"
}
```
