# The same code in two businesses

`SAME10` is unique per store, not across businesses (D2528): A and B both hold it, and each lists only its own row.

### Business A: POST /offers/:id/codes SAME10

```http
POST http://127.0.0.1:23100/offers/<OFFER_CODES>/codes
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "codes": [
    {
      "code": "SAME10"
    }
  ]
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8
etag: W/"94-0QEgsC+/A/0XWHMNOZp1Ein/voQ"

[
  {
    "id": "<CODE_A_7>",
    "offerId": "<OFFER_CODES>",
    "code": "SAME10",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:38.890Z"
  }
]
```

### Business B: POST /offers (its own code offer)

```http
POST http://127.0.0.1:23100/offers
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "kind": "product_discount",
  "method": "codes",
  "title": "Codes de B",
  "config": {
    "appliesTo": "all",
    "valueType": "percent",
    "value": 15,
    "cap": null,
    "showCountdown": false
  }
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8
etag: W/"2a9-ge2w2SRQ1/9mmCkKTQIq6lY7yIo"

{
  "id": "<OFFER_B_CODES>",
  "kind": "product_discount",
  "method": "codes",
  "title": "Codes de B",
  "label": {},
  "config": {
    "valueType": "percent",
    "value": 15,
    "cap": null,
    "appliesTo": "all",
    "showCountdown": false
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
  },
  "allowedMoves": [
    "publish",
    "archive"
  ],
  "editable": true,
  "deletable": true
}
```

### Business B: POST /offers/:id/codes SAME10 (201: A's row does not collide)

```http
POST http://127.0.0.1:23100/offers/<OFFER_B_CODES>/codes
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "codes": [
    {
      "code": "SAME10"
    }
  ]
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8
etag: W/"94-MLT5unaHVXKSM3CD8cAefqtGrRI"

[
  {
    "id": "<CODE_B_8>",
    "offerId": "<OFFER_B_CODES>",
    "code": "SAME10",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:39.199Z"
  }
]
```

### Business A again: SAME10 is taken in its own store (409)

```http
POST http://127.0.0.1:23100/offers/<OFFER_CODES>/codes
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "codes": [
    {
      "code": "SAME10"
    }
  ]
}

HTTP/1.1 409 Conflict
content-type: application/json; charset=utf-8
etag: W/"8c-pGW5l5ZP4giQPvrX+yOc630pah4"

{
  "statusCode": 409,
  "code": "offers.code-taken",
  "message": "This code is already used in this store.",
  "path": "/offers/<OFFER_CODES>/codes"
}
```

### Business A: GET /offers/:id/codes

```http
GET http://127.0.0.1:23100/offers/<OFFER_CODES>/codes
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"37e-5gEr6XNbomNqQ2W8/7L9ltGs2Ko"

[
  {
    "id": "<CODE_1>",
    "offerId": "<OFFER_CODES>",
    "code": "WELCOME10",
    "usageLimit": 50,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:37.989Z"
  },
  {
    "id": "<CODE_2>",
    "offerId": "<OFFER_CODES>",
    "code": "EV3TTLMABZ",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:38.171Z"
  },
  {
    "id": "<CODE_3>",
    "offerId": "<OFFER_CODES>",
    "code": "EVMGGZVH64",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:38.171Z"
  },
  {
    "id": "<CODE_5>",
    "offerId": "<OFFER_CODES>",
    "code": "GQ5YG7LERC",
    "usageLimit": 1,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:38.429Z"
  },
  {
    "id": "<CODE_6>",
    "offerId": "<OFFER_CODES>",
    "code": "GQ7PAFF78Q",
    "usageLimit": 1,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:38.429Z"
  },
  {
    "id": "<CODE_A_7>",
    "offerId": "<OFFER_CODES>",
    "code": "SAME10",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:38.890Z"
  }
]
```

### Business B: GET /offers/:id/codes

```http
GET http://127.0.0.1:23100/offers/<OFFER_B_CODES>/codes
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"94-MLT5unaHVXKSM3CD8cAefqtGrRI"

[
  {
    "id": "<CODE_B_8>",
    "offerId": "<OFFER_B_CODES>",
    "code": "SAME10",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:39.199Z"
  }
]
```

