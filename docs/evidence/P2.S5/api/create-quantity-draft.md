# Create a quantity draft

A new offer is a draft of the active store (store from the session, never the body); `offers.create`.

### POST /offers (quantity, two tiers, on the 4,900 product)

```http
POST http://127.0.0.1:23100/offers
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "kind": "quantity",
  "title": "عرض الكمية للأدلة",
  "config": {
    "priceMode": "percent",
    "tiers": [
      {
        "quantity": 2,
        "price": 10,
        "preselected": true,
        "freeDelivery": false
      },
      {
        "quantity": 3,
        "price": 15,
        "preselected": false,
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
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8
etag: W/"33a-sqGaESMZW5DB9gu7qLCWyvMXcRA"

{
  "id": "<OFFER_QUANTITY>",
  "kind": "quantity",
  "method": "automatic",
  "title": "عرض الكمية للأدلة",
  "label": {},
  "config": {
    "priceMode": "percent",
    "tiers": [
      {
        "quantity": 2,
        "price": 10,
        "preselected": true,
        "freeDelivery": false
      },
      {
        "quantity": 3,
        "price": 15,
        "preselected": false,
        "freeDelivery": true
      }
    ]
  },
  "combinesWith": {
    "order": false,
    "product": false,
    "delivery": false
  },
  "eligibility": {
    "audience": "everyone",
    "channels": [],
    "wilayas": [],
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
  },
  "allowedMoves": [
    "publish",
    "archive"
  ],
  "editable": true,
  "deletable": true
}
```

