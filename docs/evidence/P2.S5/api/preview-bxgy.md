# Preview buy 2 get 1

Three pieces: two paid at 4,900 and a gift line at 0 (D2504).

### POST /offers/preview

```http
POST http://127.0.0.1:23100/offers/preview
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "offer": {
    "kind": "bxgy",
    "title": "معاينة",
    "config": {
      "appliesTo": "targets",
      "buyQuantity": 2,
      "getQuantity": 1,
      "getFrom": "same",
      "gift": {
        "mode": "free"
      }
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

{
  "scenarios": [
    {
      "pieces": 3,
      "addonAccepted": false,
      "quote": {
        "lines": [
          {
            "key": "preview-buy-variant",
            "productId": "11",
            "variantId": "preview-buy-variant",
            "quantity": 2,
            "originalPrice": 4900,
            "unitPrice": 4900,
            "totalPrice": 9800,
            "discounts": []
          },
          {
            "key": "preview-buy-variant:gift:preview-offer",
            "productId": "11",
            "variantId": "preview-buy-variant",
            "quantity": 1,
            "originalPrice": 4900,
            "unitPrice": 0,
            "totalPrice": 0,
            "discounts": [
              {
                "offerId": "preview-offer",
                "kind": "bxgy",
                "amount": 4900
              }
            ],
            "giftOf": "preview-offer"
          }
        ],
        "subtotal": 9800,
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
        "total": 10600,
        "savings": 4900,
        "nudge": null,
        "suggestions": []
      }
    }
  ],
  "warnings": []
}
```

