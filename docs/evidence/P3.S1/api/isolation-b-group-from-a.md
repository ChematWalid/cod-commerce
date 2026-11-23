# Business B's pricing option from business A

A's owner names B's group id: 404 `delivery-pricing.not-found` on every route, `null` on the read (ADR 0002), B's group unchanged.

### GET /delivery-fees/:id (B's group, A's session)

```http
GET http://127.0.0.1:23100/delivery-fees/<GROUP_B_PLATFORM_DEFAULT>
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"87-Q5+HbGIP7B3EuHmZaKeRCnQyYw0"

{
  "statusCode": 404,
  "code": "delivery-pricing.not-found",
  "message": "Pricing option not found.",
  "path": "/delivery-fees/<GROUP_B_PLATFORM_DEFAULT>"
}
```

### PUT /delivery-fees/:id (B's group)

```http
PUT http://127.0.0.1:23100/delivery-fees/<GROUP_B_PLATFORM_DEFAULT>
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "name": "Renamed by A",
  "carrierId": null,
  "chargeOverweight": true,
  "overweightAllowanceKg": 5,
  "overweightRate": 50,
  "rates": [
    {
      "provinceCode": "01",
      "homePrice": 1,
      "deskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true
    },
    {
      "provinceCode": "02",
      "homePrice": 1,
      "deskPrice": 400,
      "deliveryEnabled": true,
      "deskEnabled": true
    },
    "… 67 more wilayas, Alger (16) as listed in the text"
  ]
}

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"87-Q5+HbGIP7B3EuHmZaKeRCnQyYw0"

{
  "statusCode": 404,
  "code": "delivery-pricing.not-found",
  "message": "Pricing option not found.",
  "path": "/delivery-fees/<GROUP_B_PLATFORM_DEFAULT>"
}
```

### PUT /delivery-fees/:id/communes/16 (B's group)

```http
PUT http://127.0.0.1:23100/delivery-fees/<GROUP_B_PLATFORM_DEFAULT>/communes/16
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "rows": [
    {
      "codeOns": 1601,
      "homePrice": 777,
      "deskPrice": null,
      "deliveryEnabled": null,
      "deskEnabled": null
    },
    {
      "codeOns": 1607,
      "homePrice": null,
      "deskPrice": null,
      "deliveryEnabled": false,
      "deskEnabled": null
    }
  ]
}

HTTP/1.1 404 Not Found
content-type: application/json; charset=utf-8
etag: W/"93-GF7hckLhzZWQFTJ+zvoglsS098U"

{
  "statusCode": 404,
  "code": "delivery-pricing.not-found",
  "message": "Pricing option not found.",
  "path": "/delivery-fees/<GROUP_B_PLATFORM_DEFAULT>/communes/16"
}
```

### deliveryFeeGroup(id: B's group)

```http
POST http://127.0.0.1:23100/admin-api?languageCode=en
Content-Type: application/json
Authorization: Bearer [REDACTED]
vendure-token: [REDACTED]

{
  "query": "query ($id: String!) { deliveryFeeGroup(id: $id) { id name } }",
  "variables": {
    "id": "<GROUP_B_PLATFORM_DEFAULT>"
  }
}

HTTP/1.1 200 OK
cache-control: no-store
content-type: application/json; charset=utf-8
etag: W/"23-zg4xwhyLePANSW3yliJ91Auf0Kk"

{
  "data": {
    "deliveryFeeGroup": null
  }
}
```

