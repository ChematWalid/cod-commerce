# Edit with a version

An edit may name the version it was read at (D2535); an older version is refused, so two editors never overwrite each other.

### PATCH /offers/:id at the current version 2

```http
PATCH http://127.0.0.1:23100/offers/<OFFER_QUANTITY>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
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
  "version": 2
}

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"350-tJ7DutRrZBiAHccRdQ7Ba+fZZ8U"

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
  "status": "active",
  "startsAt": null,
  "endsAt": null,
  "publishedAt": "2026-11-21T06:29:36.458Z",
  "pausedAt": null,
  "archivedAt": null,
  "usageCount": 0,
  "version": 3,
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
    "pause",
    "archive"
  ],
  "editable": true,
  "deletable": false
}
```

### PATCH /offers/:id at the old version 2: 409

```http
PATCH http://127.0.0.1:23100/offers/<OFFER_QUANTITY>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "عنوان قديم",
  "version": 2
}

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
etag: W/"a3-ZtpkdTZF9di5oR03hKYMwV5WYQA"

{
  "statusCode": 409,
  "code": "offers.offer-conflict",
  "message": "This offer was changed at the same time. Reload it and try again.",
  "path": "/offers/<OFFER_QUANTITY>"
}
```

