# Preview a quantity draft

An unsaved offer priced on sample carts at 4,900 with 800 delivery, never stored (D2516, D2534): one cart per tier, plus 1 piece.

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
      "priceMode": "percent",
      "tiers": [
        {
          "quantity": 2,
          "price": 10
        },
        {
          "quantity": 3,
          "price": 15,
          "freeDelivery": true
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
          "units": 1,
          "tierQuantity": 2,
          "saving": 980
        },
        "suggestions": []
      }
    },
    {
      "pieces": 2,
      "addonAccepted": false,
      "quote": {
        "lines": [
          {
            "key": "preview-buy-variant",
            "productId": "11",
            "variantId": "preview-buy-variant",
            "quantity": 2,
            "originalPrice": 4900,
            "unitPrice": 4410,
            "totalPrice": 8820,
            "discounts": [
              {
                "offerId": "preview-offer",
                "kind": "quantity",
                "amount": 980
              }
            ]
          }
        ],
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
          "offerId": "preview-offer",
          "units": 1,
          "tierQuantity": 3,
          "saving": 2205
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
            "unitPrice": 4165,
            "totalPrice": 12495,
            "discounts": [
              {
                "offerId": "preview-offer",
                "kind": "quantity",
                "amount": 2205
              }
            ]
          }
        ],
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
        "suggestions": []
      }
    }
  ],
  "warnings": []
}
```

### previewOffer

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($input: OfferPreviewInput!) { previewOffer(input: $input) { warnings scenarios { pieces addonAccepted quote } } }",
  "variables": {
    "input": {
      "offer": {
        "kind": "quantity",
        "title": "معاينة",
        "config": {
          "priceMode": "percent",
          "tiers": [
            {
              "quantity": 2,
              "price": 10
            },
            {
              "quantity": 3,
              "price": 15,
              "freeDelivery": true
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
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "previewOffer": {
      "warnings": [],
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
              "units": 1,
              "tierQuantity": 2,
              "saving": 980
            },
            "suggestions": []
          }
        },
        {
          "pieces": 2,
          "addonAccepted": false,
          "quote": {
            "lines": [
              {
                "key": "preview-buy-variant",
                "productId": "11",
                "variantId": "preview-buy-variant",
                "quantity": 2,
                "originalPrice": 4900,
                "unitPrice": 4410,
                "totalPrice": 8820,
                "discounts": [
                  {
                    "offerId": "preview-offer",
                    "kind": "quantity",
                    "amount": 980
                  }
                ]
              }
            ],
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
              "offerId": "preview-offer",
              "units": 1,
              "tierQuantity": 3,
              "saving": 2205
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
                "unitPrice": 4165,
                "totalPrice": 12495,
                "discounts": [
                  {
                    "offerId": "preview-offer",
                    "kind": "quantity",
                    "amount": 2205
                  }
                ]
              }
            ],
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
            "suggestions": []
          }
        }
      ]
    }
  }
}
```

