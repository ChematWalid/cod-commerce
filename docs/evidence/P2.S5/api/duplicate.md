# Duplicate

A copy is a new draft with the same configuration and targets (D2511); `offers.create`.

### POST /offers/:id/duplicate

```http
POST http://127.0.0.1:23100/offers/<OFFER_QUANTITY>/duplicate
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

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
}
```

