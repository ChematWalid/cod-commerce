# An order of one piece changed to two: delta 3,920

The order change of D2427: the order stores a total of 5,700 (`storedTotal`); its cart re-priced today is still 5,700 (`drift` 0, D2446), the changed cart is 9,620 (the 2-piece tier applies), so `delta` is 3,920 from the stored total. `orderFields` are what P4.S3 will store: one line at `quotedUnitPrice` 4,410 and the quantity offer in `appliedOffers` (D2445). The order holds no offer yet (`orderUsage` empty). Nothing is written; neither quote carries a token.

- Call: `PricingService.repriceOrderForScope(ctx, scope, input)` (in process, no HTTP route before P3.S3)
- Store: A1 (business A, store `demo`)

## Input

```json
{
  "current": {
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
  },
  "next": {
    "channel": "storefront",
    "lines": [
      {
        "variantId": "17",
        "quantity": 2
      }
    ],
    "destination": {
      "provinceCode": "16",
      "stopdesk": false
    }
  },
  "storedTotal": 5700,
  "orderUsage": {
    "offerIds": [],
    "codes": []
  }
}
```

## Output

```json
{
  "available": true,
  "before": {
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
    "quoteToken": null,
    "expiresAt": null
  },
  "after": {
    "currency": "DZD",
    "lines": [
      {
        "key": "17",
        "productId": "11",
        "variantId": "17",
        "quantity": 2,
        "originalPrice": 4900,
        "unitPrice": 4410,
        "totalPrice": 8820,
        "discounts": [
          {
            "offerId": "<OFFER_QUANTITY>",
            "kind": "quantity",
            "amount": 980
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
    "quoteToken": null,
    "expiresAt": null
  },
  "delta": 3920,
  "drift": 0,
  "orderFields": {
    "lines": [
      {
        "variantId": "17",
        "quotedUnitPrice": 4410,
        "originalPrice": 4900,
        "offerIds": [
          "<OFFER_QUANTITY>"
        ]
      }
    ],
    "quoteDiscounts": "[]",
    "quotedShipping": 800,
    "appliedOffers": [
      {
        "offerId": "<OFFER_QUANTITY>"
      }
    ],
    "buyerOrdersBefore": null
  }
}
```
