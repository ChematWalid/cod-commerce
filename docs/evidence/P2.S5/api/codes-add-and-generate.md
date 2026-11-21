# Codes: add, generate, list, remove

Codes are stored upper case and unique per store (D2406, D2512); `offers.edit` writes, `offers.view` reads.

### POST /offers/:id/codes (lower case in, upper case stored)

```http
POST http://127.0.0.1:23100/offers/<OFFER_CODES>/codes
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "codes": [
    {
      "code": "welcome10",
      "usageLimit": 50
    }
  ]
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

[
  {
    "id": "<CODE_1>",
    "offerId": "<OFFER_CODES>",
    "code": "WELCOME10",
    "usageLimit": 50,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.139Z"
  }
]
```

### POST /offers/:id/codes/generate (three, prefix EV)

```http
POST http://127.0.0.1:23100/offers/<OFFER_CODES>/codes/generate
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "count": 3,
  "prefix": "EV"
}

HTTP/1.1 201 Created
content-type: application/json; charset=utf-8

[
  {
    "id": "<CODE_2>",
    "offerId": "<OFFER_CODES>",
    "code": "EVQ6BG4T6Q",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.294Z"
  },
  {
    "id": "<CODE_3>",
    "offerId": "<OFFER_CODES>",
    "code": "EV2WZ4DKLD",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.294Z"
  },
  {
    "id": "<CODE_4>",
    "offerId": "<OFFER_CODES>",
    "code": "EV3WLR2ULA",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.294Z"
  }
]
```

### generateOfferCodes (two, prefix GQ, usage limit 1)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "mutation ($offerId: String!, $input: GenerateOfferCodesInput!) { generateOfferCodes(offerId: $offerId, input: $input) { id code usageLimit usageCount } }",
  "variables": {
    "offerId": "<OFFER_CODES>",
    "input": {
      "count": 2,
      "prefix": "GQ",
      "usageLimit": 1
    }
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8

{
  "data": {
    "generateOfferCodes": [
      {
        "id": "<CODE_5>",
        "code": "GQXGRYNMLR",
        "usageLimit": 1,
        "usageCount": 0
      },
      {
        "id": "<CODE_6>",
        "code": "GQZCGSVVKC",
        "usageLimit": 1,
        "usageCount": 0
      }
    ]
  }
}
```

### DELETE /offers/:id/codes/:code (one generated code)

```http
DELETE http://127.0.0.1:23100/offers/<OFFER_CODES>/codes/EV3WLR2ULA
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

{
  "success": true
}
```

### GET /offers/:id/codes (oldest first)

```http
GET http://127.0.0.1:23100/offers/<OFFER_CODES>/codes
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8

[
  {
    "id": "<CODE_1>",
    "offerId": "<OFFER_CODES>",
    "code": "WELCOME10",
    "usageLimit": 50,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.139Z"
  },
  {
    "id": "<CODE_2>",
    "offerId": "<OFFER_CODES>",
    "code": "EVQ6BG4T6Q",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.294Z"
  },
  {
    "id": "<CODE_3>",
    "offerId": "<OFFER_CODES>",
    "code": "EV2WZ4DKLD",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.294Z"
  },
  {
    "id": "<CODE_5>",
    "offerId": "<OFFER_CODES>",
    "code": "GQXGRYNMLR",
    "usageLimit": 1,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.534Z"
  },
  {
    "id": "<CODE_6>",
    "offerId": "<OFFER_CODES>",
    "code": "GQZCGSVVKC",
    "usageLimit": 1,
    "usageCount": 0,
    "createdAt": "2026-11-21T05:06:36.534Z"
  }
]
```

