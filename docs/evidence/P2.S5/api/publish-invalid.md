# Publish refused

A draft may be incomplete; publishing checks it (D2510) and names every problem. Here a quantity draft with no product.

### POST /offers (no target)

```http
POST http://127.0.0.1:23100/offers
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "kind": "quantity",
  "title": "مسودة بلا منتج",
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
  }
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

{
  "id": "<OFFER_INCOMPLETE>",
  "kind": "quantity",
  "method": "automatic",
  "title": "مسودة بلا منتج",
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
  "targets": [],
  "codeCount": 0,
  "performance": {
    "orders": 0,
    "deliveredRevenue": 0,
    "discountGiven": 0
  }
}
```

### POST /offers/:id/publish: 422 with the problems

```http
POST http://127.0.0.1:23100/offers/<OFFER_INCOMPLETE>/publish
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 422 Unprocessable Entity
content-type: application/json; charset=utf-8

{
  "statusCode": 422,
  "code": "offers.publish-invalid",
  "message": "This offer is not ready to publish.",
  "problems": [
    "targets"
  ],
  "path": "/offers/<OFFER_INCOMPLETE>/publish"
}
```

