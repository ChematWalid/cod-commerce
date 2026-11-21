# One offer with its code count

One offer of the active store, with `codeCount` and its performance; `offers.view`.

### GET /offers/:id

```http
GET http://127.0.0.1:23100/offers/<OFFER_CODES>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "id": "<OFFER_CODES>",
  "kind": "product_discount",
  "method": "codes",
  "title": "رموز الخصم للأدلة",
  "label": {},
  "config": {
    "cap": null,
    "value": 10,
    "appliesTo": "all",
    "valueType": "percent",
    "showCountdown": false
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
  "targets": [],
  "codeCount": 6,
  "performance": {
    "orders": 0,
    "deliveredRevenue": 0,
    "discountGiven": 0
  }
}
```

### offer(id:)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { offer(id: $id) { id kind method title status version publishedAt pausedAt archivedAt codeCount usageCount config targets { role refType refId } performance { orders deliveredRevenue discountGiven } } }",
  "variables": {
    "id": "<OFFER_CODES>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "offer": {
      "id": "<OFFER_CODES>",
      "kind": "product_discount",
      "method": "codes",
      "title": "رموز الخصم للأدلة",
      "status": "draft",
      "version": 1,
      "publishedAt": null,
      "pausedAt": null,
      "archivedAt": null,
      "codeCount": 6,
      "usageCount": 0,
      "config": {
        "cap": null,
        "value": 10,
        "appliesTo": "all",
        "valueType": "percent",
        "showCountdown": false
      },
      "targets": [],
      "performance": {
        "orders": 0,
        "deliveredRevenue": 0,
        "discountGiven": 0
      }
    }
  }
}
```

