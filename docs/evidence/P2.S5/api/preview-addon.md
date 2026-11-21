# Preview an add-on

The add-on accepted on a one-piece order: 4,900 + 1,200 + 800 delivery.

### POST /offers/preview

```http
POST http://127.0.0.1:23100/offers/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "offer": {
    "kind": "addon",
    "title": "معاينة",
    "config": {
      "condition": "any_order",
      "price": {
        "mode": "fixed",
        "value": 1200
      },
      "maxPiecesPerOrder": 3,
      "placement": "thank_you"
    },
    "targets": [
      {
        "role": "addon",
        "refType": "variant",
        "refId": "18"
      }
    ]
  },
  "samplePrice": 4900
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "scenarios": [
    {
      "pieces": 1,
      "addonAccepted": true,
      "quote": {
        "lines": [
          {
            "key": "preview-buy-variant",
            "productId": "preview-buy-product",
            "variantId": "preview-buy-variant",
            "quantity": 1,
            "originalPrice": 4900,
            "unitPrice": 4900,
            "totalPrice": 4900,
            "discounts": []
          },
          {
            "key": "18:addon:preview-offer",
            "productId": "preview-addon-product",
            "variantId": "18",
            "quantity": 1,
            "originalPrice": 4900,
            "unitPrice": 1200,
            "totalPrice": 1200,
            "discounts": [
              {
                "offerId": "preview-offer",
                "kind": "addon",
                "amount": 3700
              }
            ],
            "addonOf": "preview-offer",
            "parentVariantId": null
          }
        ],
        "subtotal": 6100,
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
        "total": 6900,
        "savings": 3700,
        "nudge": null,
        "suggestions": []
      }
    }
  ],
  "warnings": []
}
```

