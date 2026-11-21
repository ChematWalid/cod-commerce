# Preview warning: a total that does not divide

A total-price tier of 10,000 DZD for 3 pieces cannot be a whole unit price; the preview warns and still prices it.

### POST /offers/preview

```http
POST http://127.0.0.1:23100/offers/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "offer": {
    "kind": "quantity",
    "title": "معاينة",
    "config": {
      "priceMode": "total",
      "tiers": [
        {
          "quantity": 3,
          "price": 10000
        }
      ]
    },
    "targets": [
      {
        "role": "buy",
        "refType": "product",
        "refId": "11"
      }
    ]
  },
  "samplePrice": 4900
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"41f-hbvH8z6lb10ZIkDFCm7IEul13vY"

{
  "scenarios": [
    {
      "pieces": 1,
      "addonAccepted": false,
      "quote": {
        "lines": [
          {
            "key": "preview-buy-variant",
            "productId": "11",
            "variantId": "preview-buy-variant",
            "quantity": 1,
            "originalPrice": 4900,
            "unitPrice": 4900,
            "totalPrice": 4900,
            "discounts": []
          }
        ],
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
          "offerId": "preview-offer",
          "units": 2,
          "tierQuantity": 3,
          "saving": 4701
        },
        "suggestions": []
      }
    },
    {
      "pieces": 3,
      "addonAccepted": false,
      "quote": {
        "lines": [
          {
            "key": "preview-buy-variant",
            "productId": "11",
            "variantId": "preview-buy-variant",
            "quantity": 3,
            "originalPrice": 4900,
            "unitPrice": 3333,
            "totalPrice": 9999,
            "discounts": [
              {
                "offerId": "preview-offer",
                "kind": "quantity",
                "amount": 4701
              }
            ]
          }
        ],
        "subtotal": 9999,
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
        "total": 10799,
        "savings": 4701,
        "nudge": null,
        "suggestions": []
      }
    }
  ],
  "warnings": [
    "tier_total_not_divisible"
  ]
}
```

