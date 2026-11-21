# List by product

The offers bought on one product (the product editor's Offers block, D2524).

### GET /offers?productId=<the 4,900 product>

```http
GET http://127.0.0.1:23100/offers?productId=11
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "items": [
    {
      "id": "<OFFER_BXGY>",
      "kind": "bxgy",
      "method": "automatic",
      "title": "اشتر 2 واحصل على 1 للأدلة",
      "label": {},
      "config": {
        "gift": {
          "mode": "free"
        },
        "getFrom": "same",
        "appliesTo": "targets",
        "buyQuantity": 2,
        "getQuantity": 1,
        "maxTimesPerOrder": null
      },
      "combinesWith": {
        "order": false,
        "product": false,
        "delivery": false
      },
      "eligibility": {
        "wilayas": [],
        "audience": "everyone",
        "channels": [],
        "deliveryMethods": []
      },
      "totalUsageLimit": null,
      "perBuyerLimit": null,
      "status": "draft",
      "startsAt": null,
      "endsAt": null,
      "publishedAt": null,
      "pausedAt": null,
      "archivedAt": null,
      "usageCount": 0,
      "version": 1,
      "targets": [
        {
          "role": "buy",
          "refType": "product",
          "refId": "11"
        }
      ],
      "codeCount": 0,
      "performance": {
        "orders": 0,
        "deliveredRevenue": 0,
        "discountGiven": 0
      }
    },
    {
      "id": "<OFFER_COPY>",
      "kind": "quantity",
      "method": "automatic",
      "title": "عرض الكمية للأدلة",
      "label": {},
      "config": {
        "tiers": [
          {
            "price": 10,
            "quantity": 2,
            "preselected": true,
            "freeDelivery": false
          },
          {
            "price": 15,
            "quantity": 3,
            "preselected": false,
            "freeDelivery": true
          }
        ],
        "priceMode": "percent"
      },
      "combinesWith": {
        "order": false,
        "product": false,
        "delivery": false
      },
      "eligibility": {
        "wilayas": [],
        "audience": "everyone",
        "channels": [],
        "deliveryMethods": []
      },
      "totalUsageLimit": null,
      "perBuyerLimit": null,
      "status": "draft",
      "startsAt": null,
      "endsAt": null,
      "publishedAt": null,
      "pausedAt": null,
      "archivedAt": null,
      "usageCount": 0,
      "version": 1,
      "targets": [
        {
          "role": "buy",
          "refType": "product",
          "refId": "11"
        }
      ],
      "codeCount": 0,
      "performance": {
        "orders": 0,
        "deliveredRevenue": 0,
        "discountGiven": 0
      }
    },
    {
      "id": "<OFFER_QUANTITY>",
      "kind": "quantity",
      "method": "automatic",
      "title": "عرض الكمية للأدلة",
      "label": {},
      "config": {
        "tiers": [
          {
            "price": 10,
            "quantity": 2,
            "preselected": true,
            "freeDelivery": false
          },
          {
            "price": 15,
            "quantity": 3,
            "preselected": false,
            "freeDelivery": true
          }
        ],
        "priceMode": "percent"
      },
      "combinesWith": {
        "order": false,
        "product": false,
        "delivery": false
      },
      "eligibility": {
        "wilayas": [],
        "audience": "everyone",
        "channels": [],
        "deliveryMethods": []
      },
      "totalUsageLimit": null,
      "perBuyerLimit": null,
      "status": "active",
      "startsAt": null,
      "endsAt": null,
      "publishedAt": "2026-11-21T05:06:34.537Z",
      "pausedAt": null,
      "archivedAt": null,
      "usageCount": 0,
      "version": 2,
      "targets": [
        {
          "role": "buy",
          "refType": "product",
          "refId": "11"
        }
      ],
      "codeCount": 0,
      "performance": {
        "orders": 0,
        "deliveredRevenue": 0,
        "discountGiven": 0
      }
    }
  ],
  "totalItems": 3
}
```

