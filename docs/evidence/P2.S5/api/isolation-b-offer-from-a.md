# Business A on business B's offer

A's owner on its own store names B's offer id: not found everywhere, and nothing of B's changes.

### GET /offers/<B's offer>

```http
GET http://127.0.0.1:23100/offers/<OFFER_B_CODES>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"73-FDUZ2Rto3rQ4LkmdbgJ4FOFfGkk"

{
  "statusCode": 404,
  "code": "offers.offer-not-found",
  "message": "Offer not found.",
  "path": "/offers/<OFFER_B_CODES>"
}
```

### PATCH /offers/<B's offer>

```http
PATCH http://127.0.0.1:23100/offers/<OFFER_B_CODES>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "title": "Pris par A"
}

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"73-FDUZ2Rto3rQ4LkmdbgJ4FOFfGkk"

{
  "statusCode": 404,
  "code": "offers.offer-not-found",
  "message": "Offer not found.",
  "path": "/offers/<OFFER_B_CODES>"
}
```

### GET /offers/<B's offer>/codes

```http
GET http://127.0.0.1:23100/offers/<OFFER_B_CODES>/codes
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"79-A5zjrZaOTgDshxS+KgG/+0yZmcQ"

{
  "statusCode": 404,
  "code": "offers.offer-not-found",
  "message": "Offer not found.",
  "path": "/offers/<OFFER_B_CODES>/codes"
}
```

### offer(id: <B's offer>)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { offer(id: $id) { id title } }",
  "variables": {
    "id": "<OFFER_B_CODES>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"18-7B9U9tyQn9g/KvIdBam40lPYBaE"

{
  "data": {
    "offer": null
  }
}
```

### Business B reads its offer afterwards: unchanged

```http
GET http://127.0.0.1:23100/offers/<OFFER_B_CODES>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"2a9-kLrzpqAbstXUTg4g/GWfV4KHMOA"

{
  "id": "<OFFER_B_CODES>",
  "kind": "product_discount",
  "method": "codes",
  "title": "Codes de B",
  "label": {},
  "config": {
    "cap": null,
    "value": 15,
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
  "codeCount": 1,
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

