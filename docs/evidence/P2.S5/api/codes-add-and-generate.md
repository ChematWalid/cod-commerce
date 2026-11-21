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
etag: W/"95-Fra8KS/n3EMiJa29ECKyjmnFPJk"

[
  {
    "id": "<CODE_1>",
    "offerId": "<OFFER_CODES>",
    "code": "WELCOME10",
    "usageLimit": 50,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:37.989Z"
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
etag: W/"1c6-9S4tTZspG0LLXL83NcCgztlj9as"

[
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
    "id": "<CODE_4>",
    "offerId": "<OFFER_CODES>",
    "code": "EVZLXQ58XS",
    "usageLimit": null,
    "usageCount": 0,
    "createdAt": "2026-11-21T06:29:38.171Z"
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
etag: W/"be-6dvL9Sc2XhlNgAf5CDXZbK6LJng"

{
  "data": {
    "generateOfferCodes": [
      {
        "id": "<CODE_5>",
        "code": "GQ5YG7LERC",
        "usageLimit": 1,
        "usageCount": 0
      },
      {
        "id": "<CODE_6>",
        "code": "GQ7PAFF78Q",
        "usageLimit": 1,
        "usageCount": 0
      }
    ]
  }
}
```

### DELETE /offers/:id/codes/:code (one generated code)

```http
DELETE http://127.0.0.1:23100/offers/<OFFER_CODES>/codes/EVZLXQ58XS
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
etag: W/"10-oV4hJxRVSENxc/wX8+mA4/Pe4tA"

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
etag: W/"2eb-++b0BMnjdohj7Qd8TPehB7oeRoM"

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
  }
]
```

